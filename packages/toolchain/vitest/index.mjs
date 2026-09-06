import { defineConfig } from 'vitest/config';

/**
 * Preset de Vitest compartido por los paquetes y las aplicaciones de Nova
 * Platform.
 *
 *   // vitest.config.mjs
 *   import { novaVitestConfig } from '@ahincho/nova-nestjs-toolchain/vitest/index.mjs';
 *   export default novaVitestConfig();
 *
 * El archivo del proyecto va en `.mjs` y no en `.ts` a proposito: es
 * configuracion, no codigo del servicio, y como `.ts` entraria al `include` del
 * tsconfig y habria que declararle tipos que no aportan nada. Es la misma
 * decision que ya toma `eslint.config.mjs`.
 *
 * Las rutas de `include` y de cobertura son relativas al `root` de Vitest, que
 * es el directorio del archivo de configuracion del proyecto. A diferencia del
 * preset de Jest que reemplaza, aca no hace falta esquivar `<rootDir>`.
 *
 * No declara nada sobre la transformacion de TypeScript a proposito. Oxc, que
 * es quien transpila, lee el `tsconfig.json` del proyecto, y ahi es donde el
 * preset `tsconfig/nestjs.json` de este mismo paquete pone
 * `experimentalDecorators` y `emitDecoratorMetadata`. Sin la segunda no se
 * emite `design:paramtypes` y NestJS deja de poder resolver un constructor por
 * tipo, con un error que habla de un token indefinido y no de la
 * transformacion; `decorator-metadata.spec.ts` en core es lo que lo vigila.
 * Declararlo aca ademas no sirve: `tsconfigRaw` no le gana al tsconfig del
 * proyecto, comprobado poniendolo en false y viendo que la metadata se seguia
 * emitiendo.
 *
 * El umbral de cobertura vive aca a proposito: si cada repo elige el suyo, el
 * numero deja de significar algo al compararlos.
 */
/**
 * El default de Vitest son 5 s, pensados para un test unitario que no levanta
 * un framework. El primer test de cada archivo paga la carga del grafo de
 * modulos, y desde NestJS 12 ese grafo es ESM y pesa mas: medido en 740 ms con
 * la maquina libre, y visto pasar de 5 s con el build, el typecheck y el lint
 * corriendo antes en la misma pasada. Un runner de CI tiene menos nucleos.
 *
 * Lo que se evita subiendo esto no es un test lento: es un fallo intermitente
 * que se lee como un defecto del codigo.
 */
const DEFAULT_TIMEOUT_MS = 20_000;

const DEFAULT_THRESHOLDS = {
  branches: 80,
  functions: 80,
  lines: 80,
  statements: 80,
};

/**
 * @param {object} [options]
 * @param {string[]} [options.include] patrones de archivos de test
 * @param {string[]} [options.coverageInclude] fuentes que entran a la medicion
 * @param {string[]} [options.coverageExclude] la lista completa de exclusiones, no un agregado
 * @param {object|false} [options.thresholds] umbral global, o `false` para no exigir ninguno
 * @param {string[]} [options.setupFiles] modulos que se cargan antes de los tests
 * @param {number} [options.timeoutMs] limite por test y por hook
 */
export function novaVitestConfig(options = {}) {
  const {
    include = ['src/**/*.spec.ts'],
    coverageInclude = ['src/**/*.ts'],
    coverageExclude = ['**/*.spec.ts'],
    thresholds = DEFAULT_THRESHOLDS,
    setupFiles = ['reflect-metadata'],
    timeoutMs = DEFAULT_TIMEOUT_MS,
  } = options;

  return defineConfig({
    test: {
      globals: true,
      environment: 'node',
      include,
      // `reflect-metadata` tiene que estar cargado antes que el primer
      // decorador, no en el primer test. El valor por defecto asume un
      // proyecto de NestJS; un paquete sin decoradores pasa una lista
      // vacia, porque `reflect-metadata` no seria ni una dependencia suya.
      setupFiles,
      testTimeout: timeoutMs,
      // Un `beforeAll` que arma un modulo de prueba paga el mismo costo.
      hookTimeout: timeoutMs,
      coverage: {
        provider: 'v8',
        include: coverageInclude,
        exclude: coverageExclude,
        reporter: ['text', 'lcov'],
        reportsDirectory: 'coverage',
        ...(thresholds === false ? {} : { thresholds }),
      },
    },
  });
}

export default novaVitestConfig();
