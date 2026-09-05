# @ahincho/nova-nestjs

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
