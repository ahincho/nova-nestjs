---
'@ahincho/nova-nestjs-schematics': patch
---

El servicio generado ahora trae `.npmrc` y `.gitattributes`, sin los cuales no funcionaba en manos
de otra persona.

**Sin el `.npmrc` el servicio no instalaba.** La plataforma se publica en GitHub Packages, y nada
en lo que emitía el generador lo decía: `pnpm install` buscaba `@ahincho/*` en npmjs y cortaba con
un 404. El archivo lleva sólo el registry, nunca la credencial: pnpm ignora a propósito las
variables de entorno en credenciales que vengan de un `.npmrc` versionado, para que nadie se lleve
el token cambiando la URL en un pull request.

**Sin el `.gitattributes` fallaba su propia puerta de calidad.** En Windows el working copy queda
en CRLF y `nova format:check` reporta decenas de diferencias que no existen en el runner de Linux.
El `toLineFeed` que ya había arreglaba lo que se emite, no lo que pasa al clonar después.

Y el README documentaba un `pnpm dlx @ahincho/nova-nestjs-schematics service <nombre>` que no puede
funcionar -el paquete no publica ningún binario, así que corta con `ERR_PNPM_DLX_NO_BIN`-. Ahora
documenta las dos formas que sí andan, y por qué `dlx` no es una de ellas.
