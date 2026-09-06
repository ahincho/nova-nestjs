# @ahincho/nova-nestjs-toolchain

Presets de TypeScript, ESLint y Vitest compartidos por los proyectos NestJS de
Nova Platform, **y las herramientas mismas**. Un solo paquete de desarrollo;
cada preset vive en su carpeta.

```bash
pnpm add -D @ahincho/nova-nestjs-toolchain
```

Con eso llegan TypeScript, ESLint, Prettier, Vitest, el CLI de NestJS,
`@nestjs/testing`, supertest y los `@types` que hacen falta. Un servicio no
declara ninguno: igual que `@ahincho/nova-nestjs` trae NestJS, éste trae la
herramienta, en las versiones contra las que la plataforma corre su suite.

Antes eran peers opcionales, y eso dejaba la elección en cada repositorio: doce
rangos escritos por servicio que cada equipo podía mover por su cuenta.

## Hace falta una línea en el consumidor

pnpm aísla `node_modules`, así que un paquete que entra por transitividad no se
resuelve ni expone su binario. Sin esto no existen `tsc` ni `vitest`, y un
`import` de supertest corta con `TS2307`:

```yaml
# pnpm-workspace.yaml del servicio
publicHoistPattern:
  - '@nestjs/*'
  - '@types/*'
  - typescript
  - vitest
  - eslint
  - prettier
  - supertest
```

Es la misma contrapartida que en el runtime: se gana que nadie elija la versión,
se pierde el aislamiento estricto para esos paquetes.

**Los scripts del servicio siguen nombrando la herramienta** (`"test": "vitest run"`,
`"lint": "eslint ."`), así que cambiar de runner o de linter todavía obliga a
tocar cada `package.json`. Esconderlo detrás de un comando propio -`nova test`,
`nova lint`- es el paso siguiente y todavía no está hecho.

## TypeScript

```json
{
  "extends": "@ahincho/nova-nestjs-toolchain/tsconfig/nestjs.json",
  "compilerOptions": { "outDir": "./dist" }
}
```

| Archivo                | Para qué                                                                                  |
| ---------------------- | ----------------------------------------------------------------------------------------- |
| `tsconfig/base.json`   | reglas comunes: `strict`, `noUncheckedIndexedAccess`, `NodeNext`                          |
| `tsconfig/nestjs.json` | aplicaciones y paquetes NestJS: agrega `experimentalDecorators` y `emitDecoratorMetadata` |

`strictPropertyInitialization` está desactivado sólo en `nestjs.json`: la inyección
por constructor de Nest asigna las propiedades fuera del alcance del compilador.

## ESLint

```js
// eslint.config.mjs
import nova from '@ahincho/nova-nestjs-toolchain/eslint/index.mjs';
export default nova;
```

Para agregar reglas propias sin perder las de la plataforma:

```js
import nova from '@ahincho/nova-nestjs-toolchain/eslint/index.mjs';
export default [...nova, { rules: { 'no-console': 'error' } }];
```

Parte de `recommendedTypeChecked`. Las tres desviaciones están comentadas en el
archivo con su motivo; la que más importa es `no-explicit-any` en `error`, porque
en un BFF un `any` viaja desde la respuesta del upstream hasta el controlador sin
que nadie lo note.

## Vitest

```js
// vitest.config.mjs
import { novaVitestConfig } from '@ahincho/nova-nestjs-toolchain/vitest/index.mjs';
export default novaVitestConfig();
```

Fija el entorno `node`, el patrón `src/**/*.spec.ts`, las globales
(`describe`, `it`, `expect`, `vi`), la carga de `reflect-metadata` antes del
primer decorador y un umbral de cobertura del 80 %. El umbral vive en el preset
para que el número signifique lo mismo en todos los repos.

El archivo va en `.mjs` y no en `.ts` a propósito: es configuración, no código
del servicio, así que como `.ts` entraría al `include` del `tsconfig` y habría
que declararle tipos que no aportan nada. Es la misma decisión que ya toma
`eslint.config.mjs`.

Para el typecheck de los specs hace falta declarar las globales:

```json
{ "compilerOptions": { "types": ["node", "vitest/globals"] } }
```

Opciones, todas con valor por defecto:

| Opción            | Por defecto                 | Para qué                                                        |
| ----------------- | --------------------------- | --------------------------------------------------------------- |
| `include`         | `['src/**/*.spec.ts']`      | qué archivos son tests                                          |
| `coverageInclude` | `['src/**/*.ts']`           | qué fuentes entran a la medición, se ejecuten o no              |
| `coverageExclude` | `['**/*.spec.ts']`          | la lista completa de exclusiones, no un agregado a la de arriba |
| `thresholds`      | 80 % en las cuatro métricas | `false` para no exigir ninguno                                  |
| `setupFiles`      | `['reflect-metadata']`      | un paquete sin decoradores pasa `[]`                            |

**El preset no declara nada sobre la transformación de TypeScript.** Oxc, que es
quien transpila, lee el `tsconfig.json` del proyecto, y ahí es donde
`tsconfig/nestjs.json` pone `experimentalDecorators` y `emitDecoratorMetadata`.
Sin la segunda no se emite `design:paramtypes` y NestJS deja de resolver
constructores por tipo, con un error que habla de un token indefinido y manda a
buscar en el lugar equivocado; `decorator-metadata.spec.ts` en `core` es un test
de una sola aserción que existe para que ese fallo se lea como lo que es.

### Por qué Vitest y no Jest

`@nestjs/terminus` 12 es sólo ESM, así que Jest necesita
`--experimental-vm-modules` y Node >= 24.9, y esa bandera termina escrita en el
script `test` de cada servicio. NestJS 12 publica su núcleo como ESM, con lo
cual la bandera deja de sostener una dependencia y pasa a sostener el framework
entero. Vitest es ESM nativo y no la necesita.

En velocidad, sobre esta suite (283 tests, 28 archivos) los dos están parejos.
La diferencia medida está en memoria: con cobertura y caché fría, que es lo que
corre CI, Jest llegaba a ~2300 MB de pico y Vitest se queda en ~1050 MB.

La cobertura la calcula v8 en vez de Istanbul, y los números se mueven un poco:
en `core`, sentencias 98.57 -> 98.15 y ramas 92.51 -> 94.93.
