# @ahincho/nova-nestjs-toolchain

El comando `nova` y los presets de TypeScript, oxlint y Vitest compartidos por
los proyectos NestJS de Nova Platform, **y las herramientas mismas**. Un solo
paquete de desarrollo.

```bash
pnpm add -D @ahincho/nova-nestjs-toolchain
```

Con eso llegan TypeScript, oxlint, Prettier, Vitest, el CLI de NestJS,
`@nestjs/testing`, supertest y los `@types` que hacen falta. Un servicio no
declara ninguno: igual que `@ahincho/nova-nestjs` trae NestJS, éste trae la
herramienta, en las versiones contra las que la plataforma corre su suite.

Antes eran peers opcionales, y eso dejaba la elección en cada repositorio: doce
rangos escritos por servicio que cada equipo podía mover por su cuenta.

## El comando `nova`

```json
{
  "scripts": {
    "build": "nova build",
    "test": "nova test",
    "test:cov": "nova test:cov",
    "lint": "nova lint",
    "format": "nova format",
    "format:check": "nova format:check",
    "typecheck": "nova typecheck"
  }
}
```

| Comando             | Qué corre                                                               |
| ------------------- | ----------------------------------------------------------------------- |
| `nova build`        | `nest build` si hay `nest-cli.json`, si no `tsc -p tsconfig.build.json` |
| `nova test`         | `vitest run`                                                            |
| `nova test:cov`     | `vitest run --coverage`                                                 |
| `nova lint`         | `oxlint --type-aware`                                                   |
| `nova format`       | `prettier --write .`                                                    |
| `nova format:check` | `prettier --check .`                                                    |
| `nova typecheck`    | `tsc -p tsconfig.json --noEmit`                                         |
| `nova docker`       | `docker build` con el Dockerfile de la plataforma                       |
| `nova verify`       | typecheck, lint, test:cov y format:check, en ese orden                  |

Lo que sobre se le pasa tal cual a la herramienta: `nova test --watch`,
`nova lint --fix`.

`nova start` es sólo para desarrollo. **El arranque en producción se queda en
`node dist/main`**, escrito a mano, porque es el contrato con el Dockerfile y no
una elección de herramienta que la plataforma deba poder cambiar sola.

`nova verify` **no incluye `docker`**: construir una imagen no dice nada sobre si
el código está bien, y tarda como si lo dijera.

### La imagen es la misma para todos los servicios

El Dockerfile vive en este paquete, en `docker/Dockerfile`, y `nova docker` lo
usa con `-f`. **No se copia a cada repositorio**, por la misma razón por la que
los scripts dejaron de nombrar herramientas: una copia envejece, y una imagen
vieja no falla, sigue construyendo.

```bash
nova docker                                        # etiqueta <nombre>:<version>
nova docker --tag academic-acl:dev
nova docker --build-arg NODE_VERSION=26
```

La etiqueta sale del `package.json` del servicio, sin el scope. Lo que sobre se
le pasa tal cual a `docker build`.

**El token del registry viaja como secreto de BuildKit**, montado y no copiado:
un `ARG` queda en el historial de la imagen y un `COPY` queda en una capa. Si
existe un `~/.npmrc`, `nova docker` lo monta solo; en CI lo pasa el llamador con
`--secret`. El `.npmrc` del repositorio sí se copia, porque no lleva credencial:
sólo apunta el scope al registry.

Lo que cambia por servicio va como `ARG` -`NODE_VERSION`, `PNPM_VERSION`-, no
como una edición local. Y para un pipeline que exige el archivo en la raíz del
repositorio y no acepta un `-f`:

```bash
nova docker --eject
```

Escribe el Dockerfile con un encabezado diciendo de dónde salió, **debajo de la
directiva `# syntax=`**, que sólo cuenta si es la primera línea: empujarla hacia
abajo deja el build en el parser viejo, donde `--mount=type=secret` no existe y
el token tendría que entrar por un `ARG`.

El `.dockerignore` sí lo genera el schematic en cada servicio, porque Docker lo
lee desde la raíz del contexto. Es la misma división que con `.gitignore`: la
lógica se comparte, lo que describe a este repositorio se queda en él.

**El servicio deja de nombrar la herramienta**, que era lo que convertía cada
cambio de la plataforma en un cambio en cada repositorio. En un solo día hubo
dos, de Jest a Vitest y de ESLint a oxlint, y los dos obligaron a editar el
`package.json` del consumidor para reemplazar una palabra. El día que oxfmt
llegue a 1.0, `nova format` cambia acá y en ningún otro lado.

**Y hay un motivo que no es comodidad.** `oxlint` sin `--type-aware` no evalúa
las 23 reglas que necesitan tipos, y no avisa: el reporte sale verde con la
mitad del análisis sin hacer. Un script escrito a mano puede perder esa bandera
sin que nada se rompa. Acá no se puede perder.

### Corre las herramientas del toolchain, no las del proyecto

`nova` resuelve cada binario desde su propio paquete, así que no depende de lo
que el consumidor tenga a mano. Eso acorta el `publicHoistPattern`, que ya no
necesita las herramientas que sólo se invocan por script:

```yaml
# pnpm-workspace.yaml del servicio
publicHoistPattern:
  - '@nestjs/*'
  - '@types/*'
  - typescript
  - vitest
  - supertest
```

Sigue haciendo falta porque pnpm aísla `node_modules` y un paquete transitivo no
se puede importar: `vitest` porque los specs importan sus tipos, `supertest`
porque los tests lo usan, `@types/*` y `typescript` porque el `tsconfig` los
resuelve desde el proyecto. `oxlint`, `oxlint-tsgolint` y `prettier` **ya no**,
porque nadie los importa: sólo se ejecutan, y de eso se ocupa `nova`.

Una trampa que costó encontrar: **una herramienta puede lanzar a otra y la busca
en el PATH.** `oxlint --type-aware` lanza `tsgolint`, que pnpm deja en el
`node_modules/.bin` de oxlint y no en el del proyecto. Lanzarlo sin agregar ese
directorio al PATH corta con «Failed to find tsgolint executable», que es lo que
`pnpm exec` resuelve por detrás. Cortar es el buen caso; el malo habría sido que
oxlint decidiera seguir sin su compañera.

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

El límite de 20 s no es holgura: el default de Vitest son 5 s, pensados para un
test que no levanta un framework. El primer test de cada archivo paga la carga
del grafo de módulos, y desde NestJS 12 ese grafo es ESM y pesa más -740 ms con
la máquina libre, visto pasar de 5 s con el build y el lint corriendo antes en la
misma pasada-. Lo que se evita no es un test lento sino **un fallo intermitente
que se lee como un defecto del código**.

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
