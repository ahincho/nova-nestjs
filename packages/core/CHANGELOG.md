# @ahincho/nova-nestjs

## 0.10.1

### Patch Changes

- 3f2ae0c: CI y el release ahora instalan los paquetes empaquetados en el servicio de ejemplo antes de
  publicar.

  **El monorepo no puede ver un conflicto de peers**: cada paquete del workspace resuelve su
  propio árbol, así que dos dependencias incompatibles entre paquetes distintos conviven sin
  problema. Un servicio las aplana en uno solo y ahí el install corta. Así salió publicada la
  0.8.0, con `pnpm verify` en verde, y el defecto lo encontró instalar el paquete ya publicado en
  el ejemplo.

  El paso empaqueta los tres, los instala en una copia del servicio de ejemplo y corre allí el
  install, el chequeo de peers, el build y la suite. De paso ejercita el comando `nova`, que
  llega dentro del tarball del toolchain.

  Cuando un release trae un cambio incompatible el chequeo se traba, porque el ejemplo todavía no
  compila contra la versión nueva. Para eso está el input `consumer-ref` del workflow, que apunta
  el chequeo a la rama del ejemplo que ya absorbió el cambio.

## 0.10.0

### Minor Changes

- Agrega `nova start`, que faltaba para que el `package.json` de un servicio no quedara con
  `nova build` al lado de `nest start`.

  ```json
  { "scripts": { "start": "nova start", "start:dev": "nova start --watch" } }
  ```

  **El arranque en producción se queda en `node dist/main`**, escrito a mano. Es el contrato con
  el Dockerfile, no una elección de herramienta que la plataforma deba poder cambiar sola.

## 0.9.0

### Minor Changes

- Agrega el comando `nova` al toolchain, para que los scripts de un servicio dejen de nombrar la
  herramienta.

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

  `nova build` usa `nest build` si hay un `nest-cli.json` y `tsc -p tsconfig.build.json` si no.
  `nova verify` encadena typecheck, lint, cobertura y formato. Lo que sobre se le pasa tal cual a
  la herramienta.

  **Por qué.** En un solo día la plataforma cambió de runner y de linter, y las dos veces hubo que
  editar el `package.json` de cada consumidor para reemplazar una palabra. El día que oxfmt llegue
  a 1.0, `nova format` cambia en el toolchain y en ningún otro lado.

  **Y una razón que no es comodidad:** `oxlint` sin `--type-aware` no evalúa las 23 reglas que
  necesitan tipos y **no avisa**. Un script escrito a mano puede perder esa bandera sin que nada se
  rompa; dentro del comando no se puede perder.

  **El `publicHoistPattern` del servicio se acorta.** `nova` resuelve cada binario desde el paquete
  del toolchain, así que `oxlint`, `oxlint-tsgolint` y `prettier` salen de la lista: nadie los
  importa, sólo se ejecutan. Siguen `@nestjs/*`, `@types/*`, `typescript`, `vitest` y `supertest`,
  que sí se importan o se resuelven desde el `tsconfig`.

  El monorepo pasa a usarlo también, y con eso el catálogo de `pnpm-workspace.yaml` se reduce a
  `@types/node` y `rimraf`: las versiones de las herramientas viven en las `dependencies` del
  toolchain, que es donde tienen que estar.

  El paquete del toolchain además **se typechequea a sí mismo**. Su script decía «no tiene nada que
  typechequear» y eso ya era falso: publica el comando. Sin un `tsconfig` que lo cubriera,
  `oxlint --type-aware` tampoco conseguía tipos y sus reglas `no-unsafe-*` se disparaban sobre el
  archivo entero.

## 0.8.1

### Patch Changes

- Cierra un choque de peers que 0.8.0 dejó abierto y que sólo se ve desde un servicio.

  `@nestjs/cli` 12 trae `chokidar` 5 y Angular DevKit 22; los schematics declaraban DevKit 20,
  cuyo peer es `chokidar` ^4. En el monorepo no aparece, porque cada paquete resuelve su propio
  árbol; en un servicio los dos caen en el mismo y el install corta con
  `unmet peer chokidar`. Los schematics pasan a DevKit `^22.1.5`, que es el que pide
  `chokidar` ^5.

  Es exactamente para lo que está `strictPeerDependencies`, y lo que lo encontró fue instalar el
  paquete publicado en el servicio de ejemplo. Un `pnpm peers check` sobre el monorepo no basta.

  De paso, el piso de Node sube de `>=24` a `>=24.15`, que es lo que declara Angular DevKit 22
  (`^22.22.3 || ^24.15.0 || >=26.0.0`). Mismo criterio que fijó el ADR-016: el número tiene que
  poder justificarse contra el `engines` de alguna dependencia.

## 0.8.0

### Minor Changes

- Sube la plataforma a NestJS 12.

  **NestJS 12 se publica sólo como ESM**, sin build de CommonJS. La plataforma **sigue siendo
  CommonJS** y lo consume con `require(esm)`, que es el camino que el propio `nest upgrade`
  asume: no migra a ESM. Comprobado compilando y corriendo un módulo con inyección por
  constructor. Requiere Node 22.12 o superior, y el piso ya es 24.

  **Cambio incompatible, de `@nestjs/config` 12: `validationSchema` pasa de Joi a
  [Standard Schema](https://standardschema.dev/)** (Zod, Arktype, valibot). Un servicio que
  traiga un esquema de Joi tiene que cambiarlo. Quien no quiera sumar una librería puede
  omitirlo y validar dentro de sus namespaces, o pasarle `validate` a `ConfigModule`, que es una
  función y no necesita nada instalado. `NovaConfigModuleOptions.validationSchema` deja de ser
  `unknown` y toma el tipo que declara `@nestjs/config`, derivado de su propia interfaz para no
  agregar una dependencia por un tipo.

  Tres cosas nuevas que `bootstrap()` ahora fija:

  - **`routeConflictPolicy: { duplicate: 'error', shadow: 'warn' }`.** Una ruta duplicada -mismo
    método, ruta, host y versión- corta el arranque: uno de los dos manejadores es código muerto
    y cuál gana depende del orden de registro. Una ruta ensombrecida, `/users/me` contra
    `/users/:id`, sólo avisa porque a veces es deliberada. Se puede relajar con la opción
    `routeConflicts`. NestJS trae las dos en `'off'`.
  - **`return503OnClosing: true`**, la otra mitad del apagado ordenado. `enableShutdownHooks`
    avisa a los módulos, pero sin esto el proceso sigue aceptando peticiones nuevas mientras se
    apaga. Ahora una petición nueva recibe 503 -que es lo que el balanceador necesita para sacar
    la tarea de rotación- y las que ya estaban en vuelo terminan.
  - **El filtro global lee `errorCode` de la excepción.** Es lo que deja escribir
    `throw new NotFoundException('Curso no encontrado', { errorCode: 'COURSE_NOT_FOUND' })` en
    vez de una excepción propia por cada código de dominio. Sólo por debajo de 500: un 5xx
    contesta el mensaje genérico a propósito.

  Y una consecuencia del cambio de grafo de módulos: **el preset de Vitest sube el límite por
  test de 5 s a 20 s**. El primer test de cada archivo paga la carga del grafo, que desde
  NestJS 12 es ESM y pesa más -740 ms con la máquina libre, visto pasar de 5 s con el build y
  el lint corriendo antes en la misma pasada-. Se ajusta con la opción `timeoutMs`. Lo que se
  evita no es un test lento sino un fallo intermitente que se lee como un defecto del código.

## 0.7.0

### Minor Changes

- Reemplaza ESLint por oxlint como linter de la plataforma.

  **Cambio incompatible en el toolchain.** El preset
  `@ahincho/nova-nestjs-toolchain/eslint/index.mjs` desaparece y con él `eslint` y
  `typescript-eslint`, que ya no se instalan. En su lugar llegan `oxlint` y
  `oxlint-tsgolint`, y una configuración en JSON:

  ```json
  // .oxlintrc.json
  {
    "extends": [
      "./node_modules/@ahincho/nova-nestjs-toolchain/oxlint/oxlintrc.json"
    ]
  }
  ```

  La ruta va relativa y entra a `node_modules` porque **`extends` de oxlint resuelve rutas de
  archivo, no especificadores de paquete**. Como el toolchain es una dependencia directa del
  servicio, pnpm le deja un enlace real en la raíz de `node_modules`.

  Un servicio que actualice tiene que borrar su `eslint.config.mjs`, escribir ese
  `.oxlintrc.json`, cambiar `"lint"` a `oxlint --type-aware` y reemplazar `eslint` por `oxlint`
  y `oxlint-tsgolint` en su `publicHoistPattern`.

  **`--type-aware` no es opcional.** Las 23 reglas que necesitan tipos sólo corren con esa
  bandera. Sin ella oxlint no avisa: no las evalúa y el reporte sale verde con la mitad del
  análisis sin hacer.

  **Por qué.** Medido sobre un servicio real de 70 archivos con análisis de tipos en los dos
  casos: ESLint 14.4 s contra oxlint 0.75 s, con los mismos 10 hallazgos sobre un archivo de
  prueba. Y `typescript-eslint` rechaza TypeScript 7, mientras que el `tsgolint` de oxlint está
  construido sobre TS 7.

  El monorepo ahora **se lintea a sí mismo**, que antes no hacía: publicaba un preset de linter
  que nunca corría sobre su propio código. La primera pasada encontró siete hallazgos reales,
  corregidos en este mismo cambio; el más serio era un `Array.isArray` sobre un
  `readonly string[]` en `NovaConfigModule.forRoot`, que estrecha a `any[]` y metía un `any` en
  el `envFilePath` que se le pasa a `@nestjs/config`.

### Patch Changes

- 43a915a: Relaja el piso de Node de `>=24.9` a `>=24`.

  El `.9` era exactamente lo que Jest necesitaba para cargar `@nestjs/terminus` 12, que es sólo
  ESM, con `--experimental-vm-modules`. Retirado Jest en 0.6.0, ese número se quedó sin referente.

  Ninguna dependencia del árbol llega a 24.9: `vitest` 5 pide
  `^22.12.0 || ^24.0.0 || >=26.0.0`, terminus 12 pide `^20.19.0 || ^22.12.0 || >=24.0.0` y
  `eslint` 10 pide `^20.19.0 || ^22.13.0 || >=24`. Dentro de la línea 24 el piso real es 24.0.0.

  Node 24 sigue siendo el objetivo por razones propias: es LTS, es lo que corren las imágenes de
  los servicios y es lo que corre A303. Ver ADR-016 en `ahincho/nova-docs`.

## 0.6.0

### Minor Changes

- c639fc6: Reemplaza Jest por Vitest como runner de tests de la plataforma.

  **Cambio incompatible en el toolchain.** El preset
  `@ahincho/nova-nestjs-toolchain/jest` desaparece y con él `jest`, `ts-jest` y
  `@types/jest`, que ya no se instalan. En su lugar llega `vitest` con
  `@vitest/coverage-v8` y un preset nuevo:

  ```js
  // vitest.config.mjs
  import { novaVitestConfig } from '@ahincho/nova-nestjs-toolchain/vitest/index.mjs';
  export default novaVitestConfig();
  ```

  Un servicio que actualice tiene que borrar su `jest.config.js`, escribir ese
  archivo, cambiar `"test"` a `vitest run` y `"test:cov"` a `vitest run --coverage`,
  poner `"types": ["node", "vitest/globals"]` en su `tsconfig.json` y reemplazar
  `jest` por `vitest` en su `publicHoistPattern`. En los specs, `jest.fn` pasa a
  `vi.fn`, `jest.Mock` y `jest.SpyInstance` pasan a `Mock` y `MockInstance`
  importados de `vitest`, y `mockImplementation()` sin argumentos pasa a
  `mockImplementation(() => {})`.

  **Por qué.** `@nestjs/terminus` 12 es sólo ESM, así que Jest necesitaba
  `--experimental-vm-modules` y Node >= 24.9, y esa bandera terminaba escrita en el
  script `test` de cada servicio. NestJS 12 publica su núcleo como ESM, con lo cual
  la bandera pasa de sostener una dependencia a sostener el framework entero.
  Vitest es ESM nativo y no la necesita. En velocidad los dos están parejos sobre
  esta suite; la diferencia medida está en memoria, ~2300 MB de pico contra
  ~1050 MB con cobertura y caché fría, que es lo que corre CI.

  La cobertura la calcula v8 en vez de Istanbul y los números se mueven: en `core`,
  sentencias 98.57 -> 98.15 y ramas 92.51 -> 94.93. El umbral del 80 % no cambia.

## 0.5.0

## 0.4.0

### Minor Changes

- 6f78151: Autenticación por JWT como módulo opcional. `NovaModule.forRoot({ auth: {} })`
  pone un guard global: cada ruta exige `Authorization: Bearer <jwt>` y el
  controlador recibe un `Principal` con `@CurrentUser()`. Lo que no la necesita se
  marca con `@Public()`, y las sondas de salud ya lo traen. Omitir `auth` deja el
  servicio exactamente como estaba.

  El guard **no verifica la firma por defecto**: lee los claims del token tal como
  vino, que es lo correcto detrás de un gateway que ya lo validó. Un servicio
  expuesto directo pone la verificación real en la opción `verify`.

  El identificador sale de `preferred_username` y el rol de `realm_access.roles`,
  las dos configurables junto con la normalización, los roles preferidos y los que
  se descartan. Cuando el módulo de observabilidad está activo, el identificador
  se agrega al contexto y viaja como `x-user-id` hacia cada upstream sin que ningún
  punto de llamada lo pase.

  `RequestContextService` suma `enrich()`, que agrega cabeceras al contexto de la
  petición en vuelo. Existe para lo que se sabe después de abrirlo: el middleware
  corre antes que cualquier guard.

- 30edd67: NestJS deja de ser `peerDependencies` y pasa a ser **dependencia del paquete**. Un
  servicio declara `@ahincho/nova-nestjs` y nada más: `@nestjs/common`, `@nestjs/core`,
  `@nestjs/config`, `@nestjs/platform-express`, `@nestjs/terminus`, `class-validator`,
  `class-transformer`, `reflect-metadata` y `rxjs` llegan con él, en las versiones
  contra las que la plataforma corre su suite.

  Con peers, la elección de versión vivía en cada repositorio: ocho rangos que cada
  equipo podía mover por su cuenta. Ahora la versión está adentro del paquete, así que
  subir NestJS es publicar la plataforma.

  **Requiere una línea en el `pnpm-workspace.yaml` del servicio.** pnpm aísla
  `node_modules`, así que un paquete transitivo no se puede importar; sin esto,
  `import { Module } from '@nestjs/common'` corta con `TS2307`:

  ```yaml
  publicHoistPattern:
    - '@nestjs/*'
    - rxjs
    - reflect-metadata
    - class-validator
    - class-transformer
  ```

  Un servicio que siga declarando las suyas no se rompe: pnpm resuelve una sola copia
  mientras los rangos se crucen. Lo que cambia es que ya no hace falta, y que dejar de
  declararlas es lo que quita la decisión del lado del servicio.

## 0.3.0

### Minor Changes

- 3c51794: Las sondas de salud corren sobre `@nestjs/terminus`, que pasa a ser peer
  dependency. `ready` responde con el cuerpo estándar de terminus
  (`status`, `info`, `error`, `details`) y acepta indicadores nativos por
  `readinessIndicators` junto a los `readinessChecks` de siempre. Entran
  `legacyPath`, para la ruta que un target group ya existente revisa, y
  `gracefulShutdownTimeoutMs`, la ventana en que el servicio responde 503 con
  `status: 'shutting_down'` tras SIGTERM antes de cerrar. `bootstrap()` activa
  los hooks de apagado y deja la ruta heredada fuera de `globalPrefix`.

  Node mínimo pasa a 24.9: terminus 12 es ESM puro y es la versión desde la que
  Jest puede cargarlo con `require(esm)`; en runtime Node lo carga desde 22.12,
  pero la plataforma se prueba y despliega en 24.

## 0.2.1

## 0.2.0

### Minor Changes

- 12c048c: Colapsa los once paquetes en tres. `@ahincho/nova-nestjs` absorbe `api-standard`,
  `nestjs-api-standard`, `nestjs-config`, `nestjs-http`, `nestjs-observability` y
  `nestjs-health`, y reexporta entera la superficie pública de cada uno, así que
  todo lo que antes se importaba de un paquete suelto hoy se importa de este.
  `@ahincho/nova-toolchain` reúne `tsconfig`, `eslint-config` y `jest-preset`
  bajo `tsconfig/`, `eslint/` y `jest/`. Los tres paquetes comparten desde ahora
  un solo número de versión.

## 0.1.1

### Patch Changes

- Updated dependencies
  - @ahincho/nova-nestjs-observability@0.1.1

## 0.1.0

### Minor Changes

- Contexto de request, sondas de salud y el agregador que los une.

  - `nestjs-observability`: contexto sobre `AsyncLocalStorage` que sobrevive a un
    `await`, propagación de las cabeceras de correlación y redacción de las
    cabeceras sensibles en los logs, en petición y en respuesta.
  - `nestjs-health`: `/health/live` y `/health/ready`, exentas del sobre de
    respuesta, con chequeos concurrentes y con fecha límite.
  - `nestjs`: `NovaModule.forRoot()` compone los cinco paquetes y conecta el
    puerto de cabeceras salientes con el contexto de request; `bootstrap()`
    reemplaza el `main.ts` que cada servicio copiaba, y deja las sondas fuera del
    `globalPrefix`.

### Patch Changes

- Updated dependencies
- Updated dependencies [0ada154]
- Updated dependencies [b88d424]
  - @ahincho/nova-nestjs-observability@0.1.0
  - @ahincho/nova-nestjs-health@0.1.0
  - @ahincho/nova-nestjs-config@0.1.0
  - @ahincho/nova-nestjs-http@0.1.0
  - @ahincho/nova-nestjs-api-standard@0.1.0
  - @ahincho/nova-api-standard@0.1.0
