# @ahincho/nova-nestjs-toolchain

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
