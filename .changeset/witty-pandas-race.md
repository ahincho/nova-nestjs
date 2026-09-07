---
'@ahincho/nova-nestjs-schematics': minor
---

El servicio generado nace con su propio workflow de CI.

`.github/workflows/ci.yml` corre `install`, `peers check` -que `--frozen-lockfile` se saltea-,
`verify` entero, construye la imagen y **levanta el contenedor** hasta que la sonda contesta. Que
construya no prueba que arranque.

Tres cosas que salieron de haberlo montado a mano esta semana y que el generador ya trae resueltas:

- **La versión de Node vive en un solo lugar** y viaja al build como `--build-arg`. Separados, el
  runner compila con un Node distinto al que corre en producción.
- **El paso de la imagen sólo declara `NODE_AUTH_TOKEN`.** `nova docker` busca el npmrc donde npm lo
  busca -`NPM_CONFIG_USERCONFIG`, que es donde lo deja `setup-node`- y resuelve el `${NODE_AUTH_TOKEN}`
  que ese archivo guarda como marcador. Sin la variable en ese paso, el build corta con un 401.
- **El contenedor se levanta con `NODE_ENV=development`**, que ejercita que una sola imagen sirva
  para los tres ambientes.

Dispara en cada pull request sin filtrar la rama base: los repos de la organización usan `dev`, `qa`
y `master`, y una lista acá se queda vieja en cuanto alguien abre una contra otra base.
