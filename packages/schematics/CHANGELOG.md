# @ahincho/nova-nestjs-schematics

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
