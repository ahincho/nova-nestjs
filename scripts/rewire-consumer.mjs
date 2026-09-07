#!/usr/bin/env node
/**
 * Empaqueta los tres paquetes de la plataforma y reapunta un servicio
 * consumidor a esos tarballs.
 *
 *   node scripts/rewire-consumer.mjs ../nova-nestjs-example
 *
 * Existe porque **el monorepo no puede ver un conflicto de peers**. Cada
 * paquete de un workspace resuelve su propio arbol, asi que dos dependencias
 * incompatibles entre paquetes distintos conviven sin problema; un servicio las
 * aplana en un solo arbol y ahi el install corta. Eso fue exactamente lo que
 * dejo salir la 0.8.0 rota: `@nestjs/cli` 12 trae `chokidar` 5 y los schematics
 * pedian Angular DevKit 20, cuyo peer es `chokidar` ^4. `pnpm peers check`
 * sobre el monorepo pasaba en verde.
 *
 * Lo que hace:
 *
 *   1. `pnpm pack` de core, toolchain y schematics.
 *   2. Reescribe las tres dependencias del consumidor a `file:` esos tarballs.
 *   3. Borra su lockfile, que fija versiones del registry.
 *   4. Borra su `.npmrc`, que apunta el scope `@ahincho` a GitHub Packages.
 *
 * El paso 4 no es solo comodidad de credenciales: sin ese archivo, cualquier
 * `@ahincho/*` que la reescritura no haya cubierto se resuelve contra npmjs y
 * falla con un 404. O sea que ademas comprueba que los tarballs reemplazan al
 * registry por completo.
 *
 * No corre ninguna puerta de calidad. De eso se ocupa quien lo llama, para que
 * un fallo se atribuya al paso que corresponde.
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));

/** Los tres paquetes que publica la plataforma, y como los llama un servicio. */
const PACKAGES = [
  { dir: 'packages/core', name: '@ahincho/nova-nestjs', dev: false },
  {
    dir: 'packages/toolchain',
    name: '@ahincho/nova-nestjs-toolchain',
    dev: true,
  },
  {
    dir: 'packages/schematics',
    name: '@ahincho/nova-nestjs-schematics',
    dev: true,
  },
];

/**
 * @param {string} file
 * @returns {Record<string, unknown>}
 */
function readJson(file) {
  /** @type {unknown} */
  const parsed = JSON.parse(readFileSync(file, 'utf8'));

  if (typeof parsed !== 'object' || parsed === null) {
    throw new Error(`${file} no contiene un objeto`);
  }

  return /** @type {Record<string, unknown>} */ (parsed);
}

/**
 * @param {string} packageDir
 * @param {string} destination
 * @returns {string} la ruta absoluta del tarball
 */
function pack(packageDir, destination) {
  // `npm_execpath` es el JavaScript de pnpm, y lo pone el propio pnpm al correr
  // un script suyo. Lanzarlo con este mismo Node evita depender de que `pnpm`
  // se resuelva en el PATH, que es lo que rompe en Windows cuando el shell
  // exporta rutas al estilo POSIX. Por eso este script se invoca con
  // `pnpm consumer:pack` y no con `node` a secas.
  const pnpm = process.env['npm_execpath'];
  if (pnpm === undefined) {
    throw new Error(
      'no hay npm_execpath: hay que correrlo con `pnpm consumer:pack <dir>`',
    );
  }

  const output = execFileSync(
    process.execPath,
    [pnpm, 'pack', '--pack-destination', destination],
    { cwd: join(ROOT, packageDir), encoding: 'utf8' },
  );

  // pnpm imprime la ruta del tarball en la ultima linea con contenido.
  const line = output.trim().split('\n').at(-1)?.trim();
  if (line === undefined || line === '') {
    throw new Error(`pnpm pack no dijo que archivo creo en ${packageDir}`);
  }

  return resolve(destination, line);
}

const consumer = process.argv[2];
if (consumer === undefined) {
  console.error(
    'uso: node scripts/rewire-consumer.mjs <directorio-del-consumidor>',
  );
  process.exit(1);
}

const consumerDir = resolve(consumer);
const tarballDir = join(consumerDir, '.tarballs');

rmSync(tarballDir, { recursive: true, force: true });
mkdirSync(tarballDir, { recursive: true });

const manifestPath = join(consumerDir, 'package.json');
const manifest = readJson(manifestPath);
const dependencies = /** @type {Record<string, string>} */ (
  manifest['dependencies'] ?? {}
);
const devDependencies = /** @type {Record<string, string>} */ (
  manifest['devDependencies'] ?? {}
);

for (const pkg of PACKAGES) {
  const tarball = pack(pkg.dir, tarballDir);
  // Relativa para que el manifiesto no lleve una ruta de esta maquina.
  const spec = `file:./${relative(consumerDir, tarball).split('\\').join('/')}`;
  const target = pkg.dev ? devDependencies : dependencies;

  if (!(pkg.name in target)) {
    throw new Error(`el consumidor no declara ${pkg.name}`);
  }

  target[pkg.name] = spec;
  console.log(`${pkg.name} -> ${spec}`);
}

manifest['dependencies'] = dependencies;
manifest['devDependencies'] = devDependencies;
writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');

for (const file of ['pnpm-lock.yaml', '.npmrc']) {
  rmSync(join(consumerDir, file), { force: true });
}

console.log(`\nconsumidor listo en ${consumerDir}`);
console.log(
  'lockfile y .npmrc borrados: nada de @ahincho puede venir del registry',
);
