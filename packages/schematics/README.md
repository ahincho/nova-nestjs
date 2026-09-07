# @ahincho/nova-nestjs-schematics

Generadores para servicios NestJS de Nova Platform. Existen para que la forma
canónica **se genere en vez de copiarse**, que es como aparecen tres versiones
distintas del cliente del mismo upstream.

```bash
pnpm add -D @ahincho/nova-nestjs-schematics
```

## Crear un servicio entero

```bash
pnpm dlx @ahincho/nova-nestjs-schematics service academic-acl
# o, dentro de un proyecto que ya tenga la coleccion:
nest g -c @ahincho/nova-nestjs-schematics service home-bff --style=bff
```

Deja un servicio que arranca y pasa su propia puerta de calidad:

```bash
cd academic-acl && pnpm install && pnpm verify
```

Trae el `package.json` con **los tres paquetes de la plataforma y nada mas**, el
`pnpm-workspace.yaml` con su `publicHoistPattern`, los dos `tsconfig`, el
`nest-cli.json`, el `.oxlintrc.json`, el `vitest.config.mjs`, el `main.ts` con
`bootstrap()`, el `app.module.ts` con `NovaModule.forRoot()`, un test de las
sondas y las reglas de arquitectura.

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
  name: 'service-no-importa-adapter',
  from: { path: `^src/(${CONTEXT})/service/` },
  to: { path: '^src/$1/adapter/' },
}
```

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
