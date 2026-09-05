# @ahincho/nova-nestjs

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
