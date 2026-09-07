---
'@ahincho/nova-nestjs-schematics': patch
'@ahincho/nova-nestjs-toolchain': patch
'@ahincho/nova-nestjs': patch
---

CI y el release ahora instalan los paquetes empaquetados en el servicio de ejemplo antes de
publicar.

**El monorepo no puede ver un conflicto de peers**: cada paquete del workspace resuelve su
propio árbol, así que dos dependencias incompatibles entre paquetes distintos conviven sin
problema. Un servicio las aplana en uno solo y ahí el install corta. Así salió publicada la
0.8.0, con `pnpm verify` en verde, y el defecto lo encontró instalar el paquete ya publicado en
el ejemplo.

El paso empaqueta los tres, los instala en una copia del servicio de ejemplo y corre allí el
install, el chequeo de peers, el build y la suite. De paso ejercita el comando `nova`, que
llega dentro del tarball del toolchain.

Cuando un release trae un cambio incompatible el chequeo se traba, porque el ejemplo todavía no
compila contra la versión nueva. Para eso está el input `consumer-ref` del workflow, que apunta
el chequeo a la rama del ejemplo que ya absorbió el cambio.
