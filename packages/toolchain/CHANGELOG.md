# @ahincho/nova-nestjs-toolchain

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
