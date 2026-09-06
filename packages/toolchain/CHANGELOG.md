# @ahincho/nova-nestjs-toolchain

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
