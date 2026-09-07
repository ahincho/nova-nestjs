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
# invalida la instalación entera. Medido sobre un servicio generado: tocar
# `main.ts` costaba 23s de un build frío de 41s; separando los manifiestos baja
# a 7s.
#
# El `.npmrc` del repositorio es obligatorio y se copia porque no lleva
# credencial: sólo apunta el scope al registry. Un servicio sin él no puede
# resolver `@ahincho/*` de ninguna manera, así que exigirlo no agrega ninguna
# restricción que no existiera ya.
#
# El token entra como secreto de BuildKit y no como ARG ni como archivo
# copiado: un ARG queda en el historial de la imagen y un COPY queda en una
# capa. Montado, no toca ninguna de las dos.
FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
RUN --mount=type=secret,id=npmrc,target=/root/.npmrc \
    --mount=type=cache,target=/pnpm/store,sharing=locked \
    pnpm install --frozen-lockfile

# ---------------------------------------------------------------------------
# build: compila, y no toca la red
# ---------------------------------------------------------------------------
# Sin secreto montado a propósito: cuanto menos amplio sea el montaje, menos
# código de terceros puede leerlo.
FROM deps AS build
ENV CI=true
COPY . .
RUN pnpm build

# ---------------------------------------------------------------------------
# prod-deps: el árbol sin lo de desarrollo, en paralelo con el build
# ---------------------------------------------------------------------------
# Una etapa aparte y no un `pnpm prune --prod` al final del build: prune no es
# una poda local -vuelve a resolver y descarga-, así que costaba lo mismo y
# además serializaba. Acá BuildKit lo corre a la vez que la compilación, y el
# store compartido evita bajar dos veces lo mismo.
FROM base AS prod-deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
RUN --mount=type=secret,id=npmrc,target=/root/.npmrc \
    --mount=type=cache,target=/pnpm/store,sharing=locked \
    pnpm install --frozen-lockfile --prod

# ---------------------------------------------------------------------------
# runtime: node, node_modules de producción y dist
# ---------------------------------------------------------------------------
# Arranca de la imagen oficial y NO de `base`, así que pnpm no llega acá. Corre
# como `node`, el usuario sin privilegios que la imagen ya trae.
FROM node:${NODE_VERSION}-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app

COPY --from=prod-deps --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/dist ./dist
COPY --from=build --chown=node:node /app/package.json ./

USER node

# El puerto por convención de la plataforma. `bootstrap()` lee PORT y cae acá.
EXPOSE 3000

# `node` directo y no un script de pnpm: el proceso queda como PID 1 y recibe el
# SIGTERM que `enableShutdownHooks` está esperando. Con un lanzador en el medio,
# la señal muere ahí y el apagado ordenado no ocurre.
CMD ["node", "dist/main.js"]
