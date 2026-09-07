---
'@ahincho/nova-nestjs-toolchain': patch
---

La imagen compartida deja de reinstalar las dependencias cada vez que cambia una línea de código.

El `COPY . .` iba **antes** del `pnpm install`, así que cualquier cambio en `src/` invalidaba la
instalación entera. Ahora la etapa `deps` copia sólo los manifiestos, que es lo que decide si la
instalación se reusa. Medido sobre un servicio generado:

|                     | antes  | ahora  |
| ------------------- | ------ | ------ |
| build frío          | 41s    | 30s    |
| tocando sólo `src/` | 23s    | 14s    |
| tamaño              | 213 MB | 213 MB |

Se probó además una etapa `prod-deps` en paralelo, que bajaba el segundo caso a 7s. **Se descartó:**
al copiar sólo los manifiestos rompe cualquier dependencia `file:`, que necesita el archivo en el
contexto. El arnés de CI instala tarballs empaquetados y se quedaba sin ellos. Siete segundos no
valen perder un tipo de dependencia.

El `.npmrc` del repositorio pasa a ser obligatorio, porque la etapa `deps` lo copia por nombre. No
agrega ninguna restricción real: un servicio sin él no puede resolver `@ahincho/*` de ninguna
manera.
