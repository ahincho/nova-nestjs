---
'@ahincho/nova-nestjs-toolchain': patch
---

`nova docker` ya no monta el `~/.npmrc` entero en el build.

Lee del `.npmrc` del proyecto contra qué registries resuelve, saca del de la máquina **sólo las
credenciales de esos**, y las escribe en un temporal que borra al terminar. Lo dice al arrancar:

```
nova docker: credenciales para npm.pkg.github.com
```

Un `~/.npmrc` de trabajo suele llevar credenciales de otros clientes y de registries locales.
Montado entero, todo eso entraba al build. Va montado y no copiado, así que nunca quedó en una capa
de la imagen, pero cualquier `RUN` de esa etapa podía leerlo, y un `RUN` ejecuta código de terceros.

Dos correcciones que vienen con esto:

- **Busca la configuración donde npm la busca**: `NPM_CONFIG_USERCONFIG` si está definida, y si no
  el `~/.npmrc`. En un runner de GitHub no es el home -`actions/setup-node` la escribe en
  `RUNNER_TEMP`-, así que mirar sólo el home dejaba al comando sin credencial justo en CI.
- **Resuelve `${VARIABLE}`**, como hace npm al leer un `.npmrc`. El archivo de `setup-node` guarda
  `${NODE_AUTH_TOKEN}` como marcador y no el token: montado tal cual, al build le llegaba el
  marcador y el install cortaba con un 401 que no dice nada de la causa.

Un `--secret` explícito sigue desactivando todo esto.
