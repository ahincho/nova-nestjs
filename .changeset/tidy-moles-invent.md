---
'@ahincho/nova-nestjs-toolchain': minor
---

Una suite ya no muere por `NODE_ENV=test`.

Vitest fija `NODE_ENV=test`, y en esta plataforma `NODE_ENV` es el **ambiente de despliegue**:
`appEnvironment()` sólo acepta `development`, `qa` y `production`. Un test que importe código que
la llame -el `main.ts` de cualquier servicio, sin ir más lejos- moría con un `EnvironmentError`
que no tenía nada que ver con lo que se estaba probando.

El preset de Vitest fija ahora `NODE_ENV=development`. Correr una suite no es desplegar en un
ambiente llamado «test», y de los tres el que corresponde es el menos restrictivo. Un proyecto
que necesite el `test` de la convención de npm lo reestablece pasando `env` a `novaVitestConfig`,
que se mezcla encima.
