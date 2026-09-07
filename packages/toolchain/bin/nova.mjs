#!/usr/bin/env node
import { spawn } from 'node:child_process';
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { delimiter, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * El comando del toolchain de Nova Platform.
 *
 *   // package.json del servicio
 *   { "scripts": { "test": "nova test", "lint": "nova lint" } }
 *
 * Existe porque los scripts de un servicio nombraban la herramienta, y eso
 * convertía cada cambio de la plataforma en un cambio en cada repositorio. En
 * un día hubo dos: de Jest a Vitest y de ESLint a oxlint. Los dos obligaron a
 * tocar el package.json de cada consumidor para reemplazar una palabra.
 *
 * Y hay un motivo que no es comodidad. `oxlint` sin `--type-aware` no evalúa
 * las 23 reglas que necesitan tipos, y **no avisa**: el reporte sale verde con
 * la mitad del análisis sin hacer. Un script escrito a mano puede perder esa
 * bandera sin que nada se rompa. Acá no se puede perder.
 */

/** La raíz del paquete del toolchain, o sea el directorio que contiene `bin/`. */
const TOOLCHAIN_DIR = dirname(dirname(fileURLToPath(import.meta.url)));

/**
 * @typedef {object} Tool
 * @property {string} path el archivo que se ejecuta
 * @property {string} packageDir la raíz del paquete que lo publica
 */

/**
 * Encuentra el package.json de un paquete instalado.
 *
 * Se resuelve con `import.meta.resolve` y no con `require.resolve` porque el
 * `exports` de un paquete puede declarar solo la condicion `import` -es el caso
 * de `dependency-cruiser`- y entonces la resolución de CommonJS no lo alcanza.
 *
 * Y se prueban dos caminos porque **un paquete no está obligado a exportar su
 * propio manifiesto**: `dependency-cruiser` no lo hace. Cuando falta, se
 * resuelve la entrada y se sube hasta el package.json que la contiene.
 *
 * @param {string} packageName
 * @returns {string}
 */
function manifestOf(packageName) {
  try {
    return fileURLToPath(import.meta.resolve(`${packageName}/package.json`));
  } catch {
    let dir = dirname(fileURLToPath(import.meta.resolve(packageName)));

    // La raíz del paquete es el primer ancestro con un package.json. El limite
    // es llegar a la raíz del disco, donde dirname deja de cambiar.
    for (let parent = dirname(dir); ; dir = parent, parent = dirname(dir)) {
      const candidate = join(dir, 'package.json');
      if (existsSync(candidate)) {
        return candidate;
      }
      if (parent === dir) {
        throw new Error(`no se encontró el package.json de ${packageName}`);
      }
    }
  }
}

/**
 * Resuelve el binario que instaló el toolchain, no el que el consumidor tenga
 * a mano. Es lo que hace que el comando no dependa de `publicHoistPattern`:
 * el paquete se resuelve desde este archivo, que vive dentro del toolchain.
 *
 * @param {string} packageName
 * @param {string} binName
 * @returns {Tool}
 */
function toolBin(packageName, binName) {
  const manifestPath = manifestOf(packageName);
  // El `bin` de un package.json puede ser una cadena o un mapa, y quien lo
  // escribió no es esta plataforma. Se lee como `unknown` y se estrecha, en vez
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
 * detrás y acá hay que hacer a mano.
 *
 * Cortar es el buen caso. El malo sería que la herramienta decidiera seguir sin
 * su compañera, que para el análisis de tipos significa un reporte verde con la
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
 * Todos los binarios que envuelve son scripts de Node con shebang, así que se
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

/** Un salto de línea, sin escribir el escape dentro de una plantilla. */
const NEWLINE = String.fromCharCode(10);

/** El Dockerfile que comparten todos los servicios de la plataforma. */
const DOCKERFILE = join(TOOLCHAIN_DIR, 'docker', 'Dockerfile');

/**
 * Lanza un binario del sistema, no un script de Node.
 *
 * En Windows va por el shell porque `spawn` no aplica PATHEXT: sin eso,
 * `docker` corta con ENOENT aunque esté instalado y en el PATH.
 *
 * @param {string} command
 * @param {string[]} args
 * @returns {Promise<number>}
 */
function runBinary(command, args) {
  return new Promise((resolve) => {
    const child = spawn(command, args, {
      stdio: 'inherit',
      shell: process.platform === 'win32',
    });

    child.on('error', (/** @type {Error} */ error) => {
      console.error(`nova: no se pudo ejecutar '${command}': ${error.message}`);
      resolve(1);
    });
    child.on('close', (code, signal) => resolve(signal ? 1 : (code ?? 1)));
  });
}

/**
 * `<nombre>:<version>` del package.json del servicio, sin el scope.
 *
 * @returns {string}
 */
function imageTag() {
  const manifestPath = join(process.cwd(), 'package.json');
  /** @type {unknown} */
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));

  if (
    typeof manifest !== 'object' ||
    manifest === null ||
    !('name' in manifest) ||
    typeof manifest.name !== 'string'
  ) {
    throw new Error(`${manifestPath} no declara un nombre`);
  }

  const version =
    'version' in manifest && typeof manifest.version === 'string'
      ? manifest.version
      : 'latest';

  return `${manifest.name.replace(/^@/u, '').replaceAll('/', '-')}:${version}`;
}

/**
 * Escribe el Dockerfile en la raíz del servicio.
 *
 * Existe para el pipeline que exige el archivo ahí y no acepta un `-f`. Deja un
 * encabezado diciendo de dónde salió, porque una copia sin origen es
 * exactamente lo que este comando existe para evitar.
 *
 * @returns {number}
 */
function eject() {
  const target = join(process.cwd(), 'Dockerfile');

  if (existsSync(target)) {
    console.error(`nova docker: ya existe ${target}; hay que borrarlo antes`);
    return 1;
  }

  const header = `# Copiado de @ahincho/nova-nestjs-toolchain con "nova docker --eject".
# Editarlo acá lo desincroniza de la plataforma: para actualizarlo se borra y se
# vuelve a generar. Lo que necesite ser distinto por servicio va como ARG, no
# como una edición local.
`;

  // El encabezado va DESPUÉS de la directiva `# syntax=`, que sólo cuenta si es
  // la primera línea del archivo. Empujarla hacia abajo deja el build en el
  // parser viejo, y ahí `--mount=type=secret` no existe: el token tendría que
  // entrar por un ARG, que queda escrito en el historial de la imagen.
  const source = readFileSync(DOCKERFILE, 'utf8');
  const [first, ...rest] = source.split(NEWLINE);
  const content = first?.startsWith('# syntax=')
    ? [first, '', header, ...rest].join(NEWLINE)
    : header + source;

  writeFileSync(target, content);
  console.error(`nova docker: Dockerfile escrito en ${target}`);

  return 0;
}

/**
 * Construye la imagen del servicio con el Dockerfile de la plataforma.
 *
 * El Dockerfile no se copia a cada repositorio: se usa con `-f` desde el
 * toolchain. Es la misma razón por la que los scripts no nombran herramientas.
 * Una copia por servicio envejece, y una imagen vieja no avisa: sigue
 * construyendo.
 *
 * @param {string[]} args
 * @returns {Promise<number>}
 */
/** Las claves con las que un .npmrc guarda una credencial por registry. */
const CREDENTIAL_KEYS = [
  '_authToken',
  '_auth',
  'username',
  '_password',
  'email',
];

/**
 * Reemplaza `${VAR}` por su valor del entorno, que es lo que hace npm al leer
 * un .npmrc.
 *
 * Hace falta porque el archivo que escribe `actions/setup-node` guarda
 * `${NODE_AUTH_TOKEN}` como marcador, no el token. Montado tal cual en el
 * build, al `pnpm install` le llega el marcador y corta con un 401 que no dice
 * nada de la causa.
 *
 * Devuelve undefined si alguna variable no está definida: una credencial a
 * medias es peor que ninguna.
 *
 * @param {string} value
 * @returns {string | undefined}
 */
function expandEnv(value) {
  let out = '';
  let rest = value;

  for (let open = rest.indexOf('${'); open !== -1; open = rest.indexOf('${')) {
    const close = rest.indexOf('}', open);
    if (close === -1) break;

    const resolved = process.env[rest.slice(open + 2, close)];
    if (resolved === undefined) return undefined;

    out += rest.slice(0, open) + resolved;
    rest = rest.slice(close + 1);
  }

  return out + rest;
}

/**
 * Los hosts de registry que declara el .npmrc del proyecto.
 *
 * Es el proyecto quien dice contra qué registries resuelve, así que es la
 * lista correcta de credenciales a llevar al build. Todo lo demás que haya en
 * el .npmrc de la máquina no tiene nada que hacer ahí.
 *
 * @returns {Set<string>}
 */
function projectRegistries() {
  /** @type {Set<string>} */
  const hosts = new Set();
  const npmrc = join(process.cwd(), '.npmrc');

  if (!existsSync(npmrc)) return hosts;

  for (const line of readFileSync(npmrc, 'utf8').split(NEWLINE)) {
    const trimmed = line.trim();
    if (trimmed.startsWith('#') || trimmed.startsWith(';')) continue;

    const equals = trimmed.indexOf('=');
    if (equals === -1) continue;

    const key = trimmed.slice(0, equals).trim();
    if (key !== 'registry' && !key.endsWith(':registry')) continue;

    const url = expandEnv(trimmed.slice(equals + 1).trim());
    if (url === undefined) continue;

    try {
      hosts.add(new URL(url).host);
    } catch {
      // Una URL que no parsea no es un registry: se ignora en silencio, igual
      // que haría npm.
    }
  }

  return hosts;
}

/**
 * Arma un .npmrc con las credenciales de esos registries **y nada más**.
 *
 * Montar el `~/.npmrc` entero mete al build todas las credenciales de la
 * máquina: las de otro cliente, las de un registry local, las que no tienen
 * nada que ver con este servicio. Va montado y no copiado, así que no queda en
 * ninguna capa de la imagen, pero cualquier `RUN` de esa etapa puede leerlo, y
 * un `RUN` ejecuta código de terceros.
 *
 * @param {Set<string>} hosts
 * @returns {string[]}
 */
function credentialsFor(hosts) {
  // Donde npm de verdad guarda la configuración del usuario. En CI no es el
  // home: `actions/setup-node` la escribe en RUNNER_TEMP y lo anuncia por esta
  // variable, que es la que npm y pnpm leen. Mirar sólo el home dejaba a `nova
  // docker` sin credencial justo donde más hace falta.
  const npmrc =
    process.env['NPM_CONFIG_USERCONFIG'] ?? join(homedir(), '.npmrc');
  if (!existsSync(npmrc)) return [];

  /** @type {string[]} */
  const kept = [];

  for (const line of readFileSync(npmrc, 'utf8').split(NEWLINE)) {
    const trimmed = line.trim();
    if (!trimmed.startsWith('//')) continue;

    const equals = trimmed.indexOf('=');
    if (equals === -1) continue;

    const key = trimmed.slice(0, equals);
    const host = key.slice(2, key.indexOf('/', 2));
    if (!hosts.has(host)) continue;
    if (!CREDENTIAL_KEYS.some((name) => key.endsWith(`:${name}`))) continue;

    const value = expandEnv(trimmed.slice(equals + 1));
    if (value === undefined) continue;

    kept.push(`${key}=${value}`);
  }

  return kept;
}

/**
 * Construye la imagen del servicio con el Dockerfile de la plataforma.
 *
 * El Dockerfile no se copia a cada repositorio: se usa con `-f` desde el
 * toolchain. Es la misma razón por la que los scripts no nombran herramientas.
 * Una copia por servicio envejece, y una imagen vieja no avisa: sigue
 * construyendo.
 *
 * @param {string[]} args
 * @returns {Promise<number>}
 */
async function docker(args) {
  if (args.includes('--eject')) {
    return eject();
  }

  const build = ['build', '--file', DOCKERFILE];

  if (!args.some((arg) => arg === '-t' || arg === '--tag')) {
    build.push('--tag', imageTag());
  }

  /** @type {string | undefined} */
  let workspace;

  // Si el llamador pasa su propio secreto, no se toca nada: sabe lo que hace.
  if (!args.some((arg) => arg.startsWith('--secret'))) {
    const hosts = projectRegistries();
    const credentials = credentialsFor(hosts);

    if (credentials.length > 0) {
      workspace = mkdtempSync(join(tmpdir(), 'nova-docker-'));
      const scoped = join(workspace, 'npmrc');

      writeFileSync(scoped, credentials.join(NEWLINE) + NEWLINE, {
        mode: 0o600,
      });
      build.push('--secret', `id=npmrc,src=${scoped}`);

      console.error(`nova docker: credenciales para ${[...hosts].join(', ')}`);
    }
  }

  build.push(...args, '.');

  try {
    return await runBinary('docker', build);
  } finally {
    if (workspace !== undefined) {
      rmSync(workspace, { recursive: true, force: true });
    }
  }
}

/**
 * Un servicio se compila con el CLI de NestJS y un paquete con `tsc`. La
 * diferencia se decide por la presencia de `nest-cli.json`, que es el archivo
 * que distingue una aplicación de una librería, en vez de pedir una opción que
 * nadie se acordaría de poner.
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
 * @property {string} describe una línea para la ayuda
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
    'start',
    {
      // Solo para desarrollo. El arranque en producción se queda en
      // `node dist/main`, escrito a mano, porque es el contrato con el
      // Dockerfile y no una elección de herramienta que la plataforma deba
      // poder cambiar por su cuenta.
      describe: 'levanta el servicio en desarrollo (nova start --watch)',
      run: (/** @type {string[]} */ args) =>
        run('@nestjs/cli', 'nest', ['start', ...args]),
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
      // La bandera va acá y no en el script del servicio a propósito: sin ella
      // oxlint se salta las reglas con tipos en silencio.
      describe: 'lintea, siempre con análisis de tipos',
      run: (/** @type {string[]} */ args) =>
        run('oxlint', 'oxlint', ['--type-aware', ...args]),
    },
  ],
  [
    'lint:arch',
    {
      // Las reglas de arquitectura son las únicas que oxlint no puede
      // expresar: su `no-restricted-imports` filtra por el especificador y no
      // por donde está el archivo que importa, así que no sabe decir «el
      // service no importa el adapter, pero el module sí».
      describe: 'verifica las fronteras entre capas (dependency-cruiser)',
      run: (/** @type {string[]} */ args) =>
        run('dependency-cruiser', 'depcruise', ['src', '--config', ...args]),
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
      describe: 'falla si algo no está formateado',
      run: (/** @type {string[]} */ args) =>
        run('prettier', 'prettier', ['--check', '.', ...args]),
    },
  ],
  [
    'docker',
    {
      describe: 'construye la imagen con el Dockerfile de la plataforma',
      run: docker,
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
 * es lo único que no dice nada sobre si el código funciona.
 */
const VERIFY = ['typecheck', 'lint', 'lint:arch', 'test:cov', 'format:check'];

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
