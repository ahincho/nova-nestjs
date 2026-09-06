---
'@ahincho/nova-nestjs-schematics': patch
'@ahincho/nova-nestjs-toolchain': patch
'@ahincho/nova-nestjs': patch
---

Relaja el piso de Node de `>=24.9` a `>=24`.

El `.9` era exactamente lo que Jest necesitaba para cargar `@nestjs/terminus` 12, que es sólo
ESM, con `--experimental-vm-modules`. Retirado Jest en 0.6.0, ese número se quedó sin referente.

Ninguna dependencia del árbol llega a 24.9: `vitest` 5 pide
`^22.12.0 || ^24.0.0 || >=26.0.0`, terminus 12 pide `^20.19.0 || ^22.12.0 || >=24.0.0` y
`eslint` 10 pide `^20.19.0 || ^22.13.0 || >=24`. Dentro de la línea 24 el piso real es 24.0.0.

Node 24 sigue siendo el objetivo por razones propias: es LTS, es lo que corren las imágenes de
los servicios y es lo que corre A303. Ver ADR-016 en `ahincho/nova-docs`.
