# @nova-platform/nestjs-observability

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
