# @ahincho/nova-nestjs-toolchain

Presets de TypeScript, oxlint y Vitest compartidos por los proyectos NestJS de
Nova Platform, **y las herramientas mismas**. Un solo paquete de desarrollo;
cada preset vive en su carpeta.

```bash
pnpm add -D @ahincho/nova-nestjs-toolchain
```

Con eso llegan TypeScript, oxlint, Prettier, Vitest, el CLI de NestJS,
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
  - oxlint
  - oxlint-tsgolint
  - prettier
  - supertest
```

Es la misma contrapartida que en el runtime: se gana que nadie elija la versión,
se pierde el aislamiento estricto para esos paquetes.

**Los scripts del servicio siguen nombrando la herramienta** (`"test": "vitest run"`,
`"lint": "oxlint --type-aware"`), así que cambiar de runner o de linter todavía obliga a
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

## oxlint

```json
// .oxlintrc.json
{
  "extends": [
    "./node_modules/@ahincho/nova-nestjs-toolchain/oxlint/oxlintrc.json"
  ]
}
```

```json
// package.json
{ "scripts": { "lint": "oxlint --type-aware" } }
```

La ruta del `extends` va relativa y entra a `node_modules` a propósito:
**`extends` de oxlint resuelve rutas de archivo, no especificadores de paquete.**
Como el toolchain es una dependencia directa del servicio, pnpm le deja un enlace
real en la raíz de `node_modules`, así que la ruta es estable. Para agregar reglas
propias sin perder las de la plataforma, se declaran después del `extends`:

```json
{
  "extends": [
    "./node_modules/@ahincho/nova-nestjs-toolchain/oxlint/oxlintrc.json"
  ],
  "rules": { "no-console": "error" }
}
```

### `--type-aware` no es opcional

Las reglas que necesitan tipos -las 23 del bloque marcado en la configuración,
`no-floating-promises`, la familia `no-unsafe-*`, `unbound-method`- **sólo corren
con `oxlint --type-aware`**, que a su vez necesita `oxlint-tsgolint` instalado.
Sin la bandera oxlint no avisa de nada: simplemente no las evalúa, y el reporte
sale verde con la mitad del análisis sin hacer.

Por eso el script se llama `oxlint --type-aware` y no `oxlint` a secas.

### Las 23 reglas van escritas a mano

`@oxlint/migrate`, que convierte una configuración de ESLint, **descarta las reglas
con tipos en silencio**. La configuración migrada se ve completa y no lo está. Están
listadas una por una en el archivo, bajo su propio comentario, para que se note si
alguna se cae.

Misma familia de trampa que `biome migrate prettier` poniendo `semicolons: "asNeeded"`:
conviene siempre diffear el resultado de una migración automática.

### Por qué oxlint y no ESLint

Medido sobre un servicio real de 70 archivos TypeScript, con análisis de tipos en los
dos casos: **ESLint 14.4 s contra oxlint 0.75 s**, y los mismos 10 hallazgos sobre un
archivo de prueba. Sobre este monorepo, 82 archivos, oxlint tarda 1.1 s.

Hay además un motivo que no es de velocidad: `typescript-eslint` **rechaza TypeScript 7**
(`does not support TS 7.0`), y el `tsgolint` de oxlint está construido _sobre_ TS 7.

Las desviaciones respecto de la configuración recomendada están comentadas en el archivo
con su motivo. La que más importa es `no-explicit-any` en `error`, porque en un BFF un
`any` viaja desde la respuesta del upstream hasta el controlador sin que nadie lo note.

### Por qué no Biome

No tiene la familia `no-unsafe-*` -usa su propia inferencia de tipos, parcial- y rechaza
los decoradores de parámetro (`@Res()`, `@Inject()`) salvo que se encienda
`unsafeParameterDecoratorsEnabled`. En un proyecto de NestJS eso son dos problemas, no uno.

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
que declararle tipos que no aportan nada.

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
