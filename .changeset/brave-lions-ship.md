---
'@ahincho/nova-nestjs': minor
'@ahincho/nova-nestjs-schematics': minor
'@ahincho/nova-nestjs-toolchain': minor
---

**Una sola imagen para los tres ambientes.** El ambiente llega por variable de entorno en tiempo de
ejecución; nada se hornea al construir.

`appEnvironment()` lee `NODE_ENV` y devuelve `'development' | 'qa' | 'production'`. Los valores son
los que inyectan las task definitions de verdad -`development` en el bloque `dev:` y `qa` en el
`qa:`, en los siete BFF-, no una convención inventada.

Sin inyectar nada cae en `production`, que es el más restrictivo: un contenedor que nadie configuró
no publica su documentación en vez de abrirse. Pero **no acepta cualquier cosa**: un `NODE_ENV=dev`
mal escrito no es «algo que no es producción», es una task definition rota, y el contenedor lo dice
al arrancar.

Probado con una sola imagen y cinco contenedores:

```
(sin NODE_ENV)         health 200   docs 404
NODE_ENV=development   health 200   docs 200
NODE_ENV=qa            health 200   docs 200
NODE_ENV=production    health 200   docs 404
NODE_ENV=dev           EnvironmentError: must be one of development, qa, production, but was "dev"
```

Vale saber la contrapartida de usar `NODE_ENV` para esto: en qa vale `qa`, así que todo lo que
ramifica sobre `NODE_ENV === 'production'` corre en modo desarrollo ahí.

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
