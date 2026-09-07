#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { existsSync, readFileSync } from 'node:fs';
import { delimiter, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * El comando del toolchain de Nova Platform.
 *
 *   // package.json del servicio
 *   { "scripts": { "test": "nova test", "lint": "nova lint" } }
 *
 * Existe porque los scripts de un servicio nombraban la herramienta, y eso
 * convertia cada cambio de la plataforma en un cambio en cada repositorio. En
 * un dia hubo dos: de Jest a Vitest y de ESLint a oxlint. Los dos obligaron a
 * tocar el package.json de cada consumidor para reemplazar una palabra.
 *
 * Y hay un motivo que no es comodidad. `oxlint` sin `--type-aware` no evalua
 * las 23 reglas que necesitan tipos, y **no avisa**: el reporte sale verde con
 * la mitad del analisis sin hacer. Un script escrito a mano puede perder esa
 * bandera sin que nada se rompa. Aca no se puede perder.
 */

const require = createRequire(import.meta.url);

/** La raiz del paquete del toolchain, o sea el directorio que contiene `bin/`. */
const TOOLCHAIN_DIR = dirname(dirname(fileURLToPath(import.meta.url)));

/**
 * @typedef {object} Tool
 * @property {string} path el archivo que se ejecuta
 * @property {string} packageDir la raiz del paquete que lo publica
 */

/**
 * Resuelve el binario que instalo el toolchain, no el que el consumidor tenga
 * a mano. Es lo que hace que el comando no dependa de `publicHoistPattern`:
 * el paquete se resuelve desde este archivo, que vive dentro del toolchain.
 *
 * @param {string} packageName
 * @param {string} binName
 * @returns {Tool}
 */
function toolBin(packageName, binName) {
  const manifestPath = require.resolve(`${packageName}/package.json`);
  // El `bin` de un package.json puede ser una cadena o un mapa, y quien lo
  // escribio no es esta plataforma. Se lee como `unknown` y se estrecha, en vez
  // de afirmar una forma que el paquete no prometio.
  /** @type {unknown} */
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  const bin =
    typeof manifest === 'object' && manifest !== null && 'bin' in manifest
      ? manifest.bin
      : undefined;

  const entry =
    typeof bin === 'string'
      ? bin
      : typeof bin === 'object' && bin !== null && binName in bin
        ? /** @type {Record<string, unknown>} */ (bin)[binName]
        : undefined;

  if (typeof entry !== 'string') {
    throw new Error(`${packageName} no publica un binario '${binName}'`);
  }

  const packageDir = dirname(manifestPath);

  return { path: join(packageDir, entry), packageDir };
}

/**
 * Una herramienta puede lanzar a otra, y la busca en el PATH.
 *
 * `oxlint --type-aware` lanza `tsgolint`, que pnpm le deja en su propio
 * `node_modules/.bin` y no en el del proyecto. Lanzarlo sin esto corta con
 * «Failed to find tsgolint executable», que es lo que `pnpm exec` resuelve por
 * detras y aca hay que hacer a mano.
 *
 * Cortar es el buen caso. El malo seria que la herramienta decidiera seguir sin
 * su companera, que para el analisis de tipos significa un reporte verde con la
 * mitad del trabajo sin hacer.
 *
 * @param {string} packageDir
 * @returns {string}
 */
function pathWith(packageDir) {
  const bins = [
    join(packageDir, 'node_modules', '.bin'),
    join(TOOLCHAIN_DIR, 'node_modules', '.bin'),
  ].filter((dir) => existsSync(dir));

  return [...bins, process.env['PATH'] ?? ''].join(delimiter);
}

/**
 * Todos los binarios que envuelve son scripts de Node con shebang, asi que se
 * lanzan con el mismo ejecutable en vez de por el shell: no hay comillas que
 * escapar ni diferencia entre Windows y Linux.
 *
 * @param {string} packageName
 * @param {string} binName
 * @param {string[]} args
 * @returns {Promise<number>}
 */
function run(packageName, binName, args) {
  const tool = toolBin(packageName, binName);

  return new Promise((resolve) => {
    const child = spawn(process.execPath, [tool.path, ...args], {
      stdio: 'inherit',
      env: { ...process.env, PATH: pathWith(tool.packageDir) },
    });

    child.on('close', (code, signal) => resolve(signal ? 1 : (code ?? 1)));
  });
}

/**
 * Un servicio se compila con el CLI de NestJS y un paquete con `tsc`. La
 * diferencia se decide por la presencia de `nest-cli.json`, que es el archivo
 * que distingue una aplicacion de una libreria, en vez de pedir una opcion que
 * nadie se acordaria de poner.
 *
 * @param {string[]} args
 * @returns {Promise<number>}
 */
function build(args) {
  if (existsSync(join(process.cwd(), 'nest-cli.json'))) {
    return run('@nestjs/cli', 'nest', ['build', ...args]);
  }

  return run('typescript', 'tsc', ['-p', 'tsconfig.build.json', ...args]);
}

/**
 * @typedef {object} Command
 * @property {string} describe una linea para la ayuda
 * @property {(args: string[]) => Promise<number>} run
 */

/** @type {Map<string, Command>} */
const commands = new Map([
  [
    'build',
    {
      describe: 'compila: nest build en un servicio, tsc en un paquete',
      run: build,
    },
  ],
  [
    'test',
    {
      describe: 'corre la suite',
      run: (/** @type {string[]} */ args) =>
        run('vitest', 'vitest', ['run', ...args]),
    },
  ],
  [
    'test:cov',
    {
      describe: 'corre la suite con cobertura y su umbral',
      run: (/** @type {string[]} */ args) =>
        run('vitest', 'vitest', ['run', '--coverage', ...args]),
    },
  ],
  [
    'lint',
    {
      // La bandera va aca y no en el script del servicio a proposito: sin ella
      // oxlint se salta las reglas con tipos en silencio.
      describe: 'lintea, siempre con analisis de tipos',
      run: (/** @type {string[]} */ args) =>
        run('oxlint', 'oxlint', ['--type-aware', ...args]),
    },
  ],
  [
    'format',
    {
      describe: 'formatea el repositorio',
      run: (/** @type {string[]} */ args) =>
        run('prettier', 'prettier', ['--write', '.', ...args]),
    },
  ],
  [
    'format:check',
    {
      describe: 'falla si algo no esta formateado',
      run: (/** @type {string[]} */ args) =>
        run('prettier', 'prettier', ['--check', '.', ...args]),
    },
  ],
  [
    'typecheck',
    {
      describe: 'tsc --noEmit sobre el tsconfig del proyecto',
      run: (/** @type {string[]} */ args) =>
        run('typescript', 'tsc', ['-p', 'tsconfig.json', '--noEmit', ...args]),
    },
  ],
]);

/**
 * El orden importa: el typecheck antes que el lint porque un error de tipos se
 * lee mejor que los veinte hallazgos que provoca, y el formato al final porque
 * es lo unico que no dice nada sobre si el codigo funciona.
 */
const VERIFY = ['typecheck', 'lint', 'test:cov', 'format:check'];

function usage() {
  const width = Math.max(
    ...[...commands.keys(), 'verify'].map((name) => name.length),
  );

  console.error('nova <comando> [opciones]\n');
  for (const [name, command] of commands) {
    console.error(`  ${name.padEnd(width)}  ${command.describe}`);
  }
  console.error(`  ${'verify'.padEnd(width)}  ${VERIFY.join(' -> ')}`);
  console.error('\nLo que sobre se le pasa tal cual a la herramienta.');
}

/** @returns {Promise<number>} */
async function main() {
  const [name, ...args] = process.argv.slice(2);

  if (name === undefined || name === '--help' || name === '-h') {
    usage();
    return name === undefined ? 1 : 0;
  }

  if (name === 'verify') {
    for (const step of VERIFY) {
      const command = commands.get(step);
      const code = command === undefined ? 1 : await command.run(args);

      if (code !== 0) {
        console.error(`\nnova verify: fallo en '${step}'`);
        return code;
      }
    }
    return 0;
  }

  const command = commands.get(name);
  if (command === undefined) {
    console.error(`nova: no existe el comando '${name}'\n`);
    usage();
    return 1;
  }

  return command.run(args);
}

process.exitCode = await main();
