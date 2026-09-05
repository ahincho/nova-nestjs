---
'@ahincho/nova-nestjs': minor
'@ahincho/nova-toolchain': minor
'@ahincho/nova-schematics': minor
---

Colapsa los once paquetes en tres. `@ahincho/nova-nestjs` absorbe `api-standard`,
`nestjs-api-standard`, `nestjs-config`, `nestjs-http`, `nestjs-observability` y
`nestjs-health`, y reexporta entera la superficie pública de cada uno, así que
todo lo que antes se importaba de un paquete suelto hoy se importa de este.
`@ahincho/nova-toolchain` reúne `tsconfig`, `eslint-config` y `jest-preset`
bajo `tsconfig/`, `eslint/` y `jest/`. Los tres paquetes comparten desde ahora
un solo número de versión.
