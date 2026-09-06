---
'@ahincho/nova-nestjs-schematics': minor
'@ahincho/nova-nestjs-toolchain': minor
'@ahincho/nova-nestjs': minor
---

Reemplaza Jest por Vitest como runner de tests de la plataforma.

**Cambio incompatible en el toolchain.** El preset
`@ahincho/nova-nestjs-toolchain/jest` desaparece y con él `jest`, `ts-jest` y
`@types/jest`, que ya no se instalan. En su lugar llega `vitest` con
`@vitest/coverage-v8` y un preset nuevo:

```js
// vitest.config.mjs
import { novaVitestConfig } from '@ahincho/nova-nestjs-toolchain/vitest/index.mjs';
export default novaVitestConfig();
```

Un servicio que actualice tiene que borrar su `jest.config.js`, escribir ese
archivo, cambiar `"test"` a `vitest run` y `"test:cov"` a `vitest run --coverage`,
poner `"types": ["node", "vitest/globals"]` en su `tsconfig.json` y reemplazar
`jest` por `vitest` en su `publicHoistPattern`. En los specs, `jest.fn` pasa a
`vi.fn`, `jest.Mock` y `jest.SpyInstance` pasan a `Mock` y `MockInstance`
importados de `vitest`, y `mockImplementation()` sin argumentos pasa a
`mockImplementation(() => {})`.

**Por qué.** `@nestjs/terminus` 12 es sólo ESM, así que Jest necesitaba
`--experimental-vm-modules` y Node >= 24.9, y esa bandera terminaba escrita en el
script `test` de cada servicio. NestJS 12 publica su núcleo como ESM, con lo cual
la bandera pasa de sostener una dependencia a sostener el framework entero.
Vitest es ESM nativo y no la necesita. En velocidad los dos están parejos sobre
esta suite; la diferencia medida está en memoria, ~2300 MB de pico contra
~1050 MB con cobertura y caché fría, que es lo que corre CI.

La cobertura la calcula v8 en vez de Istanbul y los números se mueven: en `core`,
sentencias 98.57 -> 98.15 y ramas 92.51 -> 94.93. El umbral del 80 % no cambia.
