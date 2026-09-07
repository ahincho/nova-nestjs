---
'@ahincho/nova-nestjs-toolchain': patch
---

La imagen compartida deja de reinstalar las dependencias cada vez que cambia una línea de código.

El `COPY . .` iba **antes** del `pnpm install`, así que cualquier cambio en `src/` invalidaba la
instalación entera. Medido sobre un servicio generado, reconstruyendo tras tocar `main.ts`:

|                     | antes  | ahora  |
| ------------------- | ------ | ------ |
| build frío          | 41s    | 34s    |
| tocando sólo `src/` | 23s    | **7s** |
| tamaño              | 213 MB | 213 MB |

Ahora la etapa `deps` copia sólo los manifiestos, que es lo que decide si la instalación se reusa.

Y `pnpm prune --prod` sale del final del build a una etapa propia con `--prod`. No era una poda
local -volvía a resolver y a descargar-, así que costaba lo mismo y además serializaba: ahora
BuildKit la corre en paralelo con la compilación, compartiendo el store.

El `.npmrc` del repositorio pasa a ser obligatorio, porque la etapa `deps` lo copia por nombre. No
agrega ninguna restricción real: un servicio sin él no puede resolver `@ahincho/*` de ninguna
manera.
