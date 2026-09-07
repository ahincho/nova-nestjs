# syntax=docker/dockerfile:1.7
#
# La imagen de todo servicio NestJS de Nova Platform.
#
#   nova docker
#   nova docker --tag academic-acl:dev --build-arg NODE_VERSION=26
#   nova docker --platform linux/arm64
#
# **Una sola imagen para todos los ambientes.** No hay nada de dev, qa ni prod
# adentro: el ambiente llega como variable de entorno en tiempo de ejecución,
# que es lo que inyecta la task definition. El mismo artefacto que se probó en
# dev es el que llega a prod, byte por byte; construir uno por ambiente
# significa que lo que se aprobó no es lo que se despliega.
#
# `NODE_ENV=production` sí va fija, y no es el ambiente: le dice a Node y a las
# librerías que este es un artefacto de producción. Vale igual corriendo en dev.
#
# No se copia a cada repositorio a propósito: vive en el toolchain y `nova
# docker` la usa con `-f`. Un Dockerfile copiado envejece igual que el `main.ts`
# que el generador dejó de copiar, y envejece peor, porque una imagen vieja no
# falla: sigue construyendo.
#
# Para un pipeline que exige el archivo en la raíz del repositorio está
# `nova docker --eject`.

# La imagen base como ARG para poder fijarla por digest sin perder la variable:
#
#   nova docker --build-arg NODE_IMAGE=node@sha256:...
#
# Un tag es móvil, así que dos builds del mismo commit pueden dar imágenes
# distintas. Fijar el digest es lo que hace el build reproducible y lo que deja
# auditar qué base había el día de un incidente. Va como decisión de quien
# despliega y no fija acá, porque el digest correcto depende de la línea de Node
# que ese servicio use.
ARG NODE_VERSION=24
ARG NODE_IMAGE=node:${NODE_VERSION}-alpine
ARG PNPM_VERSION=11.24.0

# ---------------------------------------------------------------------------
# base: node y pnpm, sin nada del proyecto
# ---------------------------------------------------------------------------
# pnpm se instala con npm y no con corepack: corepack viene marcado como
# obsoleto y no está garantizado en todas las líneas de Node, así que atarse a
# él haría que subir la imagen base rompa el build por un motivo que no tiene
# nada que ver con el servicio.
FROM ${NODE_IMAGE} AS base
ARG PNPM_VERSION
# El store va a una ruta fija para que el montaje de cache de BuildKit lo
# encuentre. Como variable y no como bandera: `pnpm prune` no acepta
# `--store-dir`, y descubrirlo cuesta un build entero.
ENV npm_config_store_dir=/pnpm/store
RUN npm install --global pnpm@${PNPM_VERSION}
WORKDIR /app

# ---------------------------------------------------------------------------
# deps: el árbol completo, con el lockfile mandando
# ---------------------------------------------------------------------------
# **Sólo los manifiestos, nunca el fuente.** Es lo que decide si el build es
# rápido: con un `COPY . .` antes del install, cambiar una línea de `src/`
# invalida la instalación entera. Medido sobre un servicio generado, tocar
# `main.ts` costaba 23s de un build frío de 41s; así baja a 14s.
#
# `.tarball[s]` es un comodín que no falla cuando no existe, y ahí está el
# motivo de que la separación no funcionara antes: una dependencia `file:`
# necesita su archivo en el contexto y no aparece en ningún manifiesto. El arnés
# de CI instala tarballs empaquetados, así que sin esta línea el build muere sin
# poder resolverlos.
#
# El `.npmrc` del repositorio no lleva credencial: sólo apunta el scope al
# registry. El token entra como secreto de BuildKit y no como ARG ni
# como archivo copiado: un ARG queda en el historial de la imagen y un COPY
# queda en una capa. Montado, no toca ninguna de las dos.
FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./

# Los dos entran con un comodín que no falla cuando el archivo no está.
#
# El `.npmrc` porque un servicio que resuelve todo desde npmjs no lo necesita, y
# porque el arnés de CI lo borra a propósito -reescribe las dependencias a
# tarballs y quiere que nada pueda venir del registry-.
#
# `.tarballs/` porque ahí está el motivo de que esta separación no funcionara
# antes: una dependencia `file:` necesita su archivo en el contexto y no aparece
# en ningún manifiesto.
COPY .npmr[c] ./
COPY .tarball[s] ./.tarballs/
RUN --mount=type=secret,id=npmrc,target=/root/.npmrc \
    --mount=type=cache,target=/pnpm/store,sharing=locked \
    pnpm install --frozen-lockfile

# ---------------------------------------------------------------------------
# build: compila y se queda con las dependencias de producción
# ---------------------------------------------------------------------------
# Compilar no toca la red, así que ese paso va sin el secreto: cuanto menos
# amplio sea el montaje, menos código de terceros puede leerlo.
#
# `pnpm prune --prod` sí lo necesita. No es una poda local: vuelve a resolver el
# árbol sin las dependencias de desarrollo y descarga. Sin el secreto acá, el
# build muere con un 401 después de haber instalado bien, que es de los fallos
# más desconcertantes que puede dar esta receta.
FROM deps AS build
ENV CI=true
COPY . .
RUN pnpm build
RUN --mount=type=secret,id=npmrc,target=/root/.npmrc \
    --mount=type=cache,target=/pnpm/store,sharing=locked \
    pnpm prune --prod

# ---------------------------------------------------------------------------
# runtime: node, node_modules de producción y dist
# ---------------------------------------------------------------------------
# Arranca de la imagen base y NO de la etapa `base`, así que pnpm no llega acá.
# Corre como `node`, el usuario sin privilegios que la imagen oficial ya trae.
FROM ${NODE_IMAGE} AS runtime
ENV NODE_ENV=production
WORKDIR /app

COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/dist ./dist
COPY --from=build --chown=node:node /app/package.json ./

USER node

# El puerto por convención de la plataforma. `bootstrap()` lee PORT y cae acá.
EXPOSE 3000

# `node` directo y no un script de pnpm: el proceso queda como PID 1 y recibe el
# SIGTERM que `enableShutdownHooks` está esperando. Con un lanzador en el medio,
# la señal muere ahí y el apagado ordenado no ocurre.
CMD ["node", "dist/main.js"]
