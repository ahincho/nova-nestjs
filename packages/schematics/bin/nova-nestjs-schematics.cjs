#!/usr/bin/env node
'use strict';

/**
 * El comando de los generadores de Nova Platform.
 *
 *   pnpm dlx @ahincho/nova-nestjs-schematics service academic-acl
 *   pnpm dlx @ahincho/nova-nestjs-schematics service home-bff --style bff
 *
 * Existe porque **sin un binario no había forma cómoda de crear el primer
 * servicio**. `nest g -c` necesita un proyecto que todavía no existe, y
 * `pnpm dlx` sobre este paquete cortaba con `ERR_PNPM_DLX_NO_BIN`. Sumarle la
 * CLI del DevKit con `--package` tampoco alcanzaba: su motor resuelve la
 * colección contra el directorio actual, no contra el que arma `dlx`.
 *
 * Acá la colección se resuelve **desde este archivo**, así que da igual desde
 * dónde se invoque.
 */

const { dirname, join } = require('node:path');
const { createConsoleLogger } = require('@angular-devkit/core/node');
const { NodeWorkflow } = require('@angular-devkit/schematics/tools');

const COLLECTION = join(dirname(__dirname), 'dist', 'collection.json');

/** Opciones del flujo, no del schematic: se sacan antes de pasarlo. */
const WORKFLOW_FLAGS = new Set(['dryRun', 'force']);

/**
 * `--dry-run` llega como `dryRun`, que es como lo declara el esquema.
 *
 * @param {string} flag
 * @returns {string}
 */
function camelize(flag) {
  return flag
    .split('-')
    .map((part, index) =>
      index === 0 ? part : part.charAt(0).toUpperCase() + part.slice(1),
    )
    .join('');
}

/**
 * `true`, `false` y los números viajan con su tipo: el esquema del schematic
 * valida contra JSON Schema, y un `"false"` de texto pasa como verdadero.
 *
 * @param {string} value
 * @returns {string | number | boolean}
 */
function coerce(value) {
  if (value === 'true') return true;
  if (value === 'false') return false;
  if (value !== '' && !Number.isNaN(Number(value))) return Number(value);
  return value;
}

/**
 * @param {string[]} argv
 */
function parse(argv) {
  const [schematic, ...rest] = argv;
  /** @type {Record<string, unknown>} */
  const options = {};
  /** @type {string[]} */
  const positional = [];

  for (let index = 0; index < rest.length; index += 1) {
    const arg = rest[index];

    if (arg === undefined || !arg.startsWith('--')) {
      if (arg !== undefined) positional.push(arg);
      continue;
    }

    const body = arg.slice(2);
    const equals = body.indexOf('=');

    if (equals !== -1) {
      options[camelize(body.slice(0, equals))] = coerce(body.slice(equals + 1));
      continue;
    }

    const next = rest[index + 1];
    if (next === undefined || next.startsWith('--')) {
      options[camelize(body)] = true;
      continue;
    }

    options[camelize(body)] = coerce(next);
    index += 1;
  }

  // El primer posicional es el nombre, que es lo que piden los tres esquemas.
  if (positional[0] !== undefined && options['name'] === undefined) {
    options['name'] = positional[0];
  }

  return { schematic, options };
}

function usage() {
  console.error('nova-nestjs-schematics <generador> <nombre> [opciones]');
  console.error('');
  console.error('  service   un servicio entero, --style acl|bff');
  console.error(
    '  feature   un feature dentro de un servicio, --style acl|bff',
  );
  console.error('  upstream  la declaración de un servicio de aguas arriba');
  console.error('');
  console.error('  --dry-run   muestra lo que haría sin escribir nada');
  console.error('  --force     sobrescribe archivos existentes');
}

async function main() {
  const argv = process.argv.slice(2);

  if (argv.length === 0 || argv[0] === '--help' || argv[0] === '-h') {
    usage();
    return argv.length === 0 ? 1 : 0;
  }

  const { schematic, options } = parse(argv);

  // A diferencia de la CLI del DevKit, acá el dry-run **nunca** se enciende
  // solo. La suya lo deriva del modo debug, que a su vez deriva de si la
  // colección le parece local: eso hace que el mismo comando escriba en una
  // máquina y no escriba en otra, sin decirlo y saliendo con 0.
  const dryRun = options['dryRun'] === true;
  const force = options['force'] === true;
  for (const flag of WORKFLOW_FLAGS) delete options[flag];

  const workflow = new NodeWorkflow(process.cwd(), {
    dryRun,
    force,
    packageManager: 'pnpm',
    resolvePaths: [__dirname, process.cwd()],
    schemaValidation: true,
  });

  workflow.reporter.subscribe((event) => {
    const path = event.path.replace(/^\//u, '');

    switch (event.kind) {
      case 'error':
        console.error(
          `ERROR ${path}: ${event.description === 'alreadyExist' ? 'ya existe' : 'no existe'}`,
        );
        break;
      case 'update':
        console.error(`UPDATE ${path} (${event.content.length} bytes)`);
        break;
      case 'create':
        console.error(`CREATE ${path} (${event.content.length} bytes)`);
        break;
      case 'delete':
        console.error(`DELETE ${path}`);
        break;
      case 'rename':
        console.error(`RENAME ${path} => ${event.to.replace(/^\//u, '')}`);
        break;
      default:
        break;
    }
  });

  try {
    await workflow
      .execute({
        collection: COLLECTION,
        schematic,
        options,
        logger: createConsoleLogger(false, process.stdout, process.stderr),
        allowPrivate: false,
      })
      .toPromise();
  } catch (error) {
    console.error('');
    console.error(
      error instanceof Error ? error.message : 'el generador falló',
    );
    return 1;
  }

  if (dryRun) {
    console.error('');
    console.error('Dry run: no se escribió nada.');
  }

  return 0;
}

main()
  .then((code) => {
    process.exitCode = code;
  })
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
