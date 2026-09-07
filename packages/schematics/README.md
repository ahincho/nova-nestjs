# @ahincho/nova-nestjs-schematics

Generadores para servicios NestJS de Nova Platform. Existen para que la forma
canónica **se genere en vez de copiarse**, que es como aparecen tres versiones
distintas del cliente del mismo upstream.

```bash
pnpm add -D @ahincho/nova-nestjs-schematics
```

## Crear un servicio entero

Dentro de un proyecto que ya tenga la colección instalada:

```bash
nest g -c @ahincho/nova-nestjs-schematics service home-bff --style=bff
```

Y para el primero, cuando todavía no hay proyecto, desde cualquier directorio de
trabajo:

```bash
pnpm add -D @angular-devkit/schematics-cli @ahincho/nova-nestjs-schematics
pnpm exec schematics @ahincho/nova-nestjs-schematics:service academic-acl
```

**`pnpm dlx` no sirve acá**, y conviene saberlo antes de intentarlo. El paquete
no publica ningún binario, así que corta con `ERR_PNPM_DLX_NO_BIN`; y sumarle la
CLI del DevKit con `--package` tampoco alcanza, porque el motor resuelve la
colección contra el directorio actual y no contra el que arma `dlx`. Cerrar ese
hueco es darle al paquete un binario propio, que hoy no tiene.

Deja un servicio que arranca y pasa su propia puerta de calidad:

```bash
cd academic-acl && pnpm install && pnpm verify
```

Trae el `package.json` con **los tres paquetes de la plataforma y nada más**, el
`pnpm-workspace.yaml` con su `publicHoistPattern`, los dos `tsconfig`, el
`nest-cli.json`, el `.oxlintrc.json`, el `vitest.config.mjs`, el `main.ts` con
`bootstrap()`, el `app.module.ts` con `NovaModule.forRoot()`, un test de las
sondas y las reglas de arquitectura.

Y trae dos archivos que no se ven hasta que faltan. El `.npmrc` apunta el scope
`@ahincho` a GitHub Packages: sin él, `pnpm install` lo busca en npmjs y corta
con un 404. El `.gitattributes` fija `eol=lf`: sin él, un clon en Windows queda
en CRLF y `nova format:check` falla en local mientras pasa en el runner de
Linux, que es el falso negativo más caro de diagnosticar de los dos.

El registry sí pide credencial, y **no va en el `.npmrc` del repositorio** -pnpm
ignora las variables de entorno en credenciales que vengan de un archivo
versionado, precisamente para que nadie se lleve el token cambiando la URL en un
pull request-. Una vez por máquina:

```bash
pnpm config set "//npm.pkg.github.com/:_authToken" <token con read:packages>
```

En CI lo escribe `actions/setup-node` con `registry-url` y `NODE_AUTH_TOKEN`.

### Lo que no genera

**No hay `src/common/` ni `src/core/`.** El filtro global, el interceptor del
sobre, las sondas de salud, el cliente HTTP, la configuración, el contexto de
petición y el logger llegan dentro de `@ahincho/nova-nestjs`. En los templates
de los que sale esta forma, esas dos carpetas eran **entre el 40 % y el 50 % de
`src`**: un servicio nace con la mitad de los archivos que antes había que
copiar y después mantener sincronizados.

Tampoco genera un `Dockerfile`: la imagen base, el usuario y el puerto dependen
de dónde despliegues, y uno inventado seria peor que ninguno.

### Los dos sabores

| `--style` | Forma                                                                                                     |
| --------- | --------------------------------------------------------------------------------------------------------- |
| `acl`     | hexagonal por contexto acotado: `adapter/in`, `adapter/out`, `domain/`, `exception/`, `port/`, `service/` |
| `bff`     | `features/<pantalla>/` con los adaptadores de salida afuera, en `src/upstream/`                           |

Es la misma distinción que hace `feature`, y por el mismo motivo.

### Las reglas de arquitectura son genéricas

`.dependency-cruiser.js` sale con una regla por frontera, cada una con su motivo
escrito, y `nova lint:arch` las corre dentro de `nova verify`.

**Ninguna enumera contextos a mano.** Un comodín cubre los que existan y los que
se agreguen:

```js
const CONTEXT = '[^/]+';
{
  name: 'service-must-not-import-adapter',
  from: { path: `^src/(${CONTEXT})/service/` },
  to: { path: '^src/$1/adapter/' },
}
```

El `name` va en inglés porque es un identificador -aparece en la salida y es la
clave de un baseline de `--ignore-known`-; el `comment` va en español, que es lo
que lee quien ve saltar la regla.

Es deliberado: una regla que lista los contextos uno por uno **sigue en verde
cuando aparece el octavo**, y nadie se entera de que dejó de mirarlo.

## Declarar un upstream

```bash
nest g -c @ahincho/nova-nestjs-schematics upstream academic-orchestrator
```

Escribe cuatro archivos en `src/upstream/academic-orchestrator/`:

| Archivo           | Qué trae                                                              |
| ----------------- | --------------------------------------------------------------------- |
| `.config.ts`      | `defineUpstream()`; lee `ACADEMIC_ORCHESTRATOR_URL` y `_TIMEOUT_MS`   |
| `.client.ts`      | cliente sobre `HttpClientService`, con el timeout de su configuración |
| `.module.ts`      | `ConfigModule.forFeature()` y el cliente exportado                    |
| `.client.spec.ts` | dos pruebas que ya pasan                                              |

El nombre acepta kebab-case o camelCase; el prefijo de las variables sale de él
y coincide con lo que lee `defineUpstream()` en tiempo de ejecución.

## Crear un feature

```bash
nest g -c @ahincho/nova-nestjs-schematics feature buildings              # acl
nest g -c @ahincho/nova-nestjs-schematics feature courses --style bff
```

Los dos estilos son **la misma arquitectura hexagonal**. Lo que cambia es dónde
queda el adaptador de salida:

|                     | `acl` (por defecto)            | `bff`                                 |
| ------------------- | ------------------------------ | ------------------------------------- |
| Ubicación           | `src/<name>/`                  | `src/features/<name>/`                |
| Adaptador de salida | dentro, en `adapter/out/`      | afuera, en `src/upstream/` compartido |
| `domain/`           | sí                             | no; el contrato es el DTO             |
| Puerto de salida    | `port/out/find-<name>.port.ts` | el cliente del upstream               |

Un BFF saca sus adaptadores a `upstream/` porque varios features llaman al mismo
servicio. Un ACL los deja dentro y agrega `domain/`, que es lo que le permite
absorber un cambio del sistema legado sin propagarlo.

## Opciones

| Opción  | Por defecto                                                                                     |
| ------- | ----------------------------------------------------------------------------------------------- |
| `name`  | requerido; primer argumento                                                                     |
| `style` | `acl` (en `service` y en `feature`)                                                             |
| `path`  | `<name>` en `service`; `src/upstream/<name>`, `src/<name>` o `src/features/<name>` en los otros |

## Sobre los tests de este paquete

Un paquete de schematics publica **plantillas**, no sólo código, y el runner las
carga desde disco. Por eso la suite de integración corre contra `dist` — probar
el fuente probaría algo que nadie instala. `pnpm verify` compila antes de
testear, que es el orden que esos tests asumen.
