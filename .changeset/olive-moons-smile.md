---
'@ahincho/nova-nestjs': minor
'@ahincho/nova-nestjs-toolchain': minor
'@ahincho/nova-nestjs-schematics': minor
---

Agrega OpenAPI, la imagen de contenedor compartida y el binario de los generadores.

**OpenAPI.** `bootstrap({ openapi: { title } })` publica el documento en `/docs/json` y su interfaz
en `/docs`. Omitir la opción no publica nada, igual que con CORS y con `auth`: exponer la
documentación es una decisión de quien despliega.

La parte que un `@nestjs/swagger` suelto no puede resolver es el sobre. El interceptor envuelve la
respuesta **después** de que el controlador la devolvió, así que un documento generado del tipo de
retorno describe el método y no el cable, y un cliente generado de ahí no compila contra el
servicio. `ApiEnvelope(Dto)` y `ApiErrors(404)` cierran esa distancia, y el código de error de cada
fallo sale de `statusToErrorCode`, la misma función que usa el filtro de excepciones en ejecución.

El requisito del token va en la raíz del documento y no operación por operación, porque el guard de
`NovaAuthModule` también es global: un decorador por método dejaría documentado como abierto todo lo
que alguien olvidó anotar.

**La imagen.** `nova docker` construye con un Dockerfile que vive en el toolchain y se usa con
`-f`, así que es el mismo para todos los servicios. Cuatro etapas, sin pnpm ni código fuente en la
final, corriendo como el usuario `node`. El token del registry entra como secreto de BuildKit
-montado, no copiado: un `ARG` queda en el historial de la imagen-. Lo que varía por servicio va
como `ARG`. Para un pipeline que exige el archivo en la raíz está `nova docker --eject`.

**El binario.** `pnpm dlx @ahincho/nova-nestjs-schematics service academic-acl` ahora funciona sin
instalar nada. Antes no había forma cómoda de crear el primer servicio: `nest g -c` necesita un
proyecto que todavía no existe, y `pnpm dlx` cortaba con `ERR_PNPM_DLX_NO_BIN`.

**El servicio generado** nace con los dos: `openapi` en su `main.ts` -apagable con
`OPENAPI_ENABLED`-, un test que pide `/docs/json`, un `.dockerignore` y el script `nova docker`.

**Al actualizar hay que agregar una línea.** `@nestjs/swagger` arrastra `@scarf/scarf`, cuyo script
de instalación es telemetría, y pnpm **aborta el install** cuando hay un script sin decidir. Un
servicio que ya existe falla en `pnpm install` -antes de compilar nada- hasta que su
`pnpm-workspace.yaml` diga:

```yaml
allowBuilds:
  '@scarf/scarf': false
```

Los servicios nuevos ya nacen con esa línea. Apagarlo no le quita nada: la documentación se sirve
igual.
