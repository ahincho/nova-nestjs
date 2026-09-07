# syntax=docker/dockerfile:1.7
#
# La imagen de todo servicio NestJS de Nova Platform.
#
#   nova docker
#   nova docker --tag academic-acl:dev --build-arg NODE_VERSION=26
#
# No se copia a cada repositorio a propósito: vive en el toolchain y `nova
# docker` la usa con `-f`. Un Dockerfile copiado envejece igual que el `main.ts`
# que el generador dejó de copiar, y envejece peor, porque una imagen vieja no
# falla: sigue construyendo.
#
# Para un pipeline que exige el archivo en la raíz del repositorio está
# `nova docker --eject`, que lo escribe con un encabezado diciendo de dónde
# salió.

ARG NODE_VERSION=24
ARG PNPM_VERSION=11.24.0

# ---------------------------------------------------------------------------
# base: node y pnpm, sin nada del proyecto
# ---------------------------------------------------------------------------
# pnpm se instala con npm y no con corepack: corepack viene marcado como
# obsoleto y no está garantizado en todas las líneas de Node, así que atarse a
# él haría que subir la imagen base rompa el build por un motivo que no tiene
# nada que ver con el servicio.
FROM node:${NODE_VERSION}-alpine AS base
ARG PNPM_VERSION
RUN npm install --global pnpm@${PNPM_VERSION}
WORKDIR /app

# ---------------------------------------------------------------------------
# build: instala, compila y descarta lo que sólo servía para compilar
# ---------------------------------------------------------------------------
# El contexto entero entra antes de instalar, y no sólo los manifiestos. La
# receta clásica -copiar package.json, instalar, después copiar el código- se
# apoya en la caché de capas, y acá esa caché la da el montaje del store de
# pnpm: con el store caliente, un cambio de código relinkea en vez de volver a
# descargar.
#
# A cambio funciona con un servicio cuyas dependencias son archivos del propio
# repositorio, que es como se prueba esta imagen en CI. Con los manifiestos
# sueltos, un `file:./.tarballs/...` no resuelve porque el archivo no está en la
# etapa.
#
# Lo que no entra lo decide el `.dockerignore` del servicio, y `node_modules` es
# el que importa: sin él se copian binarios nativos de Windows dentro de una
# imagen Linux.
#
# El token del registry entra como secreto de BuildKit y no como ARG ni como
# archivo copiado: un ARG queda en el historial de la imagen y un COPY queda en
# una capa. Montado, no toca ninguna de las dos. El `.npmrc` del repositorio sí
# se copia, porque no lleva credencial: sólo apunta el scope al registry.
FROM base AS build

# `pnpm prune` borra node_modules, y sin TTY corta pidiendo confirmación
# -ERR_PNPM_ABORTED_REMOVE_MODULES_DIR_NO_TTY-. Un build de imagen es no
# interactivo por definición, así que decirlo es lo correcto; la alternativa,
# `confirmModulesPurge: false`, cambiaría también el comportamiento de quien
# corre pnpm a mano en su máquina.
ENV CI=true

COPY . .
RUN --mount=type=secret,id=npmrc,target=/root/.npmrc \
    --mount=type=cache,target=/pnpm/store,sharing=locked \
    pnpm install --frozen-lockfile --store-dir /pnpm/store
RUN pnpm build && pnpm prune --prod

# ---------------------------------------------------------------------------
# runtime: node, node_modules de producción y dist
# ---------------------------------------------------------------------------
# Sin pnpm ni el código fuente. Corre como `node`, el usuario sin privilegios
# que la imagen oficial ya trae.
FROM node:${NODE_VERSION}-alpine AS runtime
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
