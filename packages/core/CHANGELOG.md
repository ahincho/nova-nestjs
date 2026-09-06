# @ahincho/nova-nestjs

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
