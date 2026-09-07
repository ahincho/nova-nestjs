---
'@ahincho/nova-nestjs': minor
'@ahincho/nova-nestjs-schematics': minor
'@ahincho/nova-nestjs-toolchain': minor
---

**Una sola imagen para dev, qa y prod.** El ambiente llega por variable de entorno en tiempo de
ejecución; nada se hornea al construir.

`appEnvironment()` lee `APP_ENV` y devuelve `'dev' | 'qa' | 'prod'`. **No tiene valor por defecto, y
eso es el punto**: un contenedor sin la variable no arranca y el error la nombra. Con un valor por
defecto, el que se olvidó de inyectarla en prod arranca creyéndose otra cosa, y no se descubre hasta
que alguien nota que la documentación está publicada donde no debía.

No es `NODE_ENV`, y confundirlos es el error que esto existe para evitar: `NODE_ENV=production` va
fija en la imagen y le habla a Node, no al despliegue.

Probado con una sola imagen y tres contenedores:

```
sin APP_ENV   EnvironmentError: Environment variable APP_ENV is required but was not set   exit 1
APP_ENV=dev   health 200   docs 200
APP_ENV=qa    health 200   docs 200
APP_ENV=prod  health 200   docs 404
```

El servicio generado lo usa para decidir si publica su documentación, y `.env.example` documenta la
variable. Reemplaza a `OPENAPI_ENABLED`.

### Y la imagen se construye más rápido

La etapa `deps` copia sólo los manifiestos, así que cambiar una línea de `src/` ya no reinstala
nada: **de 23s a 14s** reconstruyendo tras tocar `main.ts`.

Antes esto rompía las dependencias `file:` -necesitan su archivo en el contexto y no aparecen en
ningún manifiesto- y el `.npmrc`, que el arnés de CI borra a propósito. Los dos entran ahora con un
comodín que no falla cuando el archivo no está.

Además:

- **`NODE_IMAGE` como ARG**, para poder fijar la base por digest sin perder la variable de versión:
  `nova docker --build-arg NODE_IMAGE=node@sha256:...`. Un tag es móvil, así que dos builds del
  mismo commit pueden dar imágenes distintas.
- **`test/` sale del contexto**, así que cambiar un spec ya no invalida la capa de compilación.
- **CI exporta la cache de BuildKit** (`type=gha`). Vivía en el runner, y el runner se destruye: sin
  eso cada build de CI era frío.
