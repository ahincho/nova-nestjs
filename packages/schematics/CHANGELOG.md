# @ahincho/nova-schematics

## 0.1.0

### Minor Changes

- Generadores de la plataforma, nivel 5.

  - `upstream`: declara un upstream completo -configuración, cliente sobre
    `HttpClientService`, módulo y su spec- en la forma que la plataforma espera.
  - `feature`: crea un feature en los dos layouts que conviven, `acl` y `bff`.
    Son la misma arquitectura hexagonal; lo que cambia es si el adaptador de
    salida vive dentro del feature o afuera, compartido en `src/upstream/`.

  Existen para que la forma canónica se genere en vez de copiarse, que es como
  aparecen tres versiones distintas del cliente del mismo upstream.
