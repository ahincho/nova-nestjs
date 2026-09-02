# @ahincho/nova-schematics

## 0.1.1

### Patch Changes

- El feature generado en estilo `acl` ahora pasa el lint de la plataforma.

  Dos cosas que salieron de correr `eslint` sobre lo generado: el modulo
  importaba el token del puerto de salida solo para nombrarlo en un comentario, y
  el spec del servicio casteaba un doble que ya satisface el puerto por su forma
  -que es, justamente, la razon de que el puerto sea una interfaz-.

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
