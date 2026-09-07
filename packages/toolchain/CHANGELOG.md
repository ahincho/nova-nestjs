# @ahincho/nova-nestjs-toolchain

## 0.12.0

### Minor Changes

- 40c6d5a: Agrega OpenAPI, la imagen de contenedor compartida y el binario de los generadores.

  **OpenAPI.** `bootstrap({ openapi: { title } })` publica el documento en `/docs/json` y su interfaz
  en `/docs`. Omitir la opción no publica nada, igual que con CORS y con `auth`: exponer la
  documentación es una decisión de quien despliega.

  La parte que un `@nestjs/swagger` suelto no puede resolver es el sobre. El interceptor envuelve la
  respuesta **después** de que el controlador la devolvió, así que un documento generado del tipo de
  retorno describe el método y no el cable, y un cliente generado de ahí no compila contra el
  servicio. `ApiEnvelope(Dto)` y `ApiErrors(404)` cierran esa distancia, y el código de error de cada
  fallo sale de `statusToErrorCode`, la misma función que usa el filtro de excepciones en ejecución.

  El requisito del token va en la raíz del documento y no operación por operación, porque el guard de
  `NovaAuthModule` también es global: un decorador por método dejaría documentado como abierto todo lo
  que alguien olvidó anotar.

  **La imagen.** `nova docker` construye con un Dockerfile que vive en el toolchain y se usa con
  `-f`, así que es el mismo para todos los servicios. Cuatro etapas, sin pnpm ni código fuente en la
  final, corriendo como el usuario `node`. El token del registry entra como secreto de BuildKit
  -montado, no copiado: un `ARG` queda en el historial de la imagen-. Lo que varía por servicio va
  como `ARG`. Para un pipeline que exige el archivo en la raíz está `nova docker --eject`.

  **El binario.** `pnpm dlx @ahincho/nova-nestjs-schematics service academic-acl` ahora funciona sin
  instalar nada. Antes no había forma cómoda de crear el primer servicio: `nest g -c` necesita un
  proyecto que todavía no existe, y `pnpm dlx` cortaba con `ERR_PNPM_DLX_NO_BIN`.

  **El servicio generado** nace con los dos: `openapi` en su `main.ts` -apagable con
  `OPENAPI_ENABLED`-, un test que pide `/docs/json`, un `.dockerignore` y el script `nova docker`.

  **Al actualizar hay que agregar una línea.** `@nestjs/swagger` arrastra `@scarf/scarf`, cuyo script
  de instalación es telemetría, y pnpm **aborta el install** cuando hay un script sin decidir. Un
  servicio que ya existe falla en `pnpm install` -antes de compilar nada- hasta que su
  `pnpm-workspace.yaml` diga:

  ```yaml
  allowBuilds:
    '@scarf/scarf': false
  ```

  Los servicios nuevos ya nacen con esa línea. Apagarlo no le quita nada: la documentación se sirve
  igual.

## 0.11.1

### Patch Changes

- Corrige el idioma de las reglas de arquitectura que genera el schematic, y las tildes de los
  comentarios.

  **Los 14 `name` de `.dependency-cruiser.js` estaban en español** -`service-no-importa-adapter`-
  copiados tal cual de los templates de donde salió esta forma. Un `name` es un identificador:
  aparece en la salida y es la clave con la que un baseline de `--ignore-known` referencia la
  regla, así que va en inglés. Ahora son `service-must-not-import-adapter`,
  `context-must-not-import-another-context`, `feature-uses-only-the-upstream-port` y así.

  El `comment` de cada regla se queda en español, porque es lo que lee una persona cuando la regla
  salta. Eso no cambia.

  **Y las tildes.** Los comentarios en español las llevan, y se habían perdido en 11 archivos
  \-`nova.mjs`, el preset de Vitest, la configuración de oxlint, el script del chequeo de
  consumidor, el generador y sus plantillas-. Restituidas, revisando a mano los casos que un
  reemplazo automático se equivoca: `quien` relativo no lleva tilde y `quién` interrogativo sí.

  Sólo cambia texto: ningún comportamiento.

## 0.11.0

### Minor Changes

- Agrega el generador de servicio y `nova lint:arch`.

  ```bash
  pnpm dlx @ahincho/nova-nestjs-schematics service academic-acl
  cd academic-acl && pnpm install && pnpm verify
  ```

  Deja un servicio que arranca y **pasa su propia puerta de calidad**: los tres paquetes de la
  plataforma y nada más, el `publicHoistPattern`, los dos `tsconfig`, el `nest-cli.json`, el
  `.oxlintrc.json`, el `vitest.config.mjs`, `bootstrap()`, `NovaModule.forRoot()`, un test de las
  sondas y las reglas de arquitectura. Con `--style=bff` o `--style=acl`, la misma distinción que
  ya hace `feature`.

  **Lo que no genera es el argumento del paquete: no hay `src/common/` ni `src/core/`.** El filtro
  global, el interceptor del sobre, las sondas, el cliente HTTP, la configuración, el contexto de
  petición y el logger llegan dentro de `@ahincho/nova-nestjs`. Medido sobre los templates de los
  que sale esta forma, esas dos carpetas eran **el 50 % de `src` en un BFF y el 40 % en un ACL**.

  **`nova lint:arch`** corre `dependency-cruiser`, que entra al toolchain. Es la única puerta que
  oxlint no puede cubrir: su `no-restricted-imports` filtra por el especificador y no por dónde
  está el archivo que importa, así que no sabe decir «el service no importa el adapter, pero el
  module sí». Va dentro de `nova verify`.

  **Las reglas generadas no enumeran contextos a mano**, usan un comodín. Una regla que los lista
  uno por uno sigue en verde cuando aparece el siguiente, y nadie se entera de que dejó de mirarlo.

  Dos arreglos que salieron de generar y correr el servicio de verdad:

  - `nova` resolvía los binarios con `require.resolve`, que no alcanza a un paquete cuyo `exports`
    declara sólo la condición `import` -es el caso de `dependency-cruiser`- ni a uno que no exporta
    su propio `package.json`. Ahora usa `import.meta.resolve` y, si hace falta, sube desde la
    entrada hasta el manifiesto.
  - El generador normaliza los finales de línea a LF: el motor de plantillas del DevKit devuelve
    CRLF en Windows, y el servicio recién generado no pasaba su propio `format:check`.

  No genera `Dockerfile`: la imagen base, el usuario y el puerto dependen de dónde se despliegue.

## 0.10.2

### Patch Changes

- Documenta cómo se comporta de verdad `return503OnClosing`, que estaba descrito de más.

  Decía que durante el apagado «una petición nueva recibe 503», a secas. **Actúa sobre las
  conexiones ya establecidas.** Medido con el cierre disparado en t=1200 ms:

  | Qué                                      | Resultado                   |
  | ---------------------------------------- | --------------------------- |
  | petición en vuelo cuando llega el cierre | **200**, terminó completa   |
  | petición nueva, conexión ya abierta      | **503 Service Unavailable** |
  | petición nueva, conexión TCP nueva       | **ECONNREFUSED**            |

  Una conexión nueva se rechaza antes de que exista una petición HTTP que contestar, porque el
  listener ya dejó de aceptar. Para el caso real es lo correcto -un balanceador mantiene la
  conexión abierta- pero **probarlo con un `curl` suelto muestra el rechazo y no el 503**, y se
  lee como que la opción no funciona.

  Está en `packages/core/docs/health.md`, con la receta de `http.Agent({ keepAlive: true })` que
  hace falta para verlo. Sólo cambia documentación y un comentario.

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

### Minor Changes

- 0762925: El toolchain deja de pedir las herramientas como peers y **las trae**. Instalarlo
  alcanza para compilar, probar, revisar y formatear: TypeScript, ESLint, Prettier,
  Jest, ts-jest, el CLI de NestJS, `@nestjs/schematics`, `@nestjs/testing`, supertest
  y los `@types` de node, jest y supertest.

  Es el mismo movimiento que se hizo en el runtime. Con peers opcionales la elección
  de versión vivía en cada repositorio: doce rangos escritos por servicio que cada
  equipo podía mover por su cuenta. Ahora un servicio declara este paquete y ya.

  **Requiere ampliar el `publicHoistPattern` del servicio**, porque pnpm no resuelve
  un paquete transitivo ni expone su binario:

  ```yaml
  publicHoistPattern:
    - '@nestjs/*'
    - '@types/*'
    - typescript
    - jest
    - ts-jest
    - eslint
    - prettier
    - supertest
  ```

  Los scripts del servicio siguen nombrando la herramienta (`"test": "jest"`), así
  que cambiar de runner todavía obliga a tocar cada `package.json`. Esconderlo
  detrás de un comando propio es el paso siguiente.

## 0.4.0

### Patch Changes

- dd046ba: El preset de TypeScript escribe el archivo de estado incremental **dentro del
  `outDir`**, con `tsBuildInfoFile: "${configDir}/dist/tsconfig.tsbuildinfo"`.

  Por defecto queda al lado del `tsconfig`, o sea fuera de `dist`, y entonces los
  dos pueden contradecirse. Cualquier cosa que borre `dist` sin borrarlo -el
  `deleteOutDir` de nest-cli, un `rimraf`, alguien a mano- deja el estado
  afirmando que ya está todo compilado: **`nest build` no emite nada y termina
  con éxito**, y el fallo aparece recién en el contenedor, como un
  `MODULE_NOT_FOUND` sobre `dist/main.js`.

  Reproducido en el servicio de ejemplo y en los paquetes de este repositorio.
  Adentro del `outDir` se borran juntos y no pueden discrepar.

## 0.3.0

## 0.2.1

### Patch Changes

- 6a1e5e3: Renombra `@ahincho/nova-schematics` a `@ahincho/nova-nestjs-schematics` y
  `@ahincho/nova-toolchain` a `@ahincho/nova-nestjs-toolchain`, para que los tres
  paquetes compartan el prefijo `nova-nestjs`. El contenido no cambia.

## 0.2.0

### Minor Changes

- 12c048c: Colapsa los once paquetes en tres. `@ahincho/nova-nestjs` absorbe `api-standard`,
  `nestjs-api-standard`, `nestjs-config`, `nestjs-http`, `nestjs-observability` y
  `nestjs-health`, y reexporta entera la superficie pública de cada uno, así que
  todo lo que antes se importaba de un paquete suelto hoy se importa de este.
  `@ahincho/nova-toolchain` reúne `tsconfig`, `eslint-config` y `jest-preset`
  bajo `tsconfig/`, `eslint/` y `jest/`. Los tres paquetes comparten desde ahora
  un solo número de versión.
