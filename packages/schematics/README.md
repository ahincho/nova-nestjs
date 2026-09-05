# @ahincho/nova-nestjs-schematics

Generadores para servicios NestJS de Nova Platform. Existen para que la forma
canónica **se genere en vez de copiarse**, que es como aparecen tres versiones
distintas del cliente del mismo upstream.

```bash
pnpm add -D @ahincho/nova-nestjs-schematics
```

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

| Opción  | Por defecto                                                 |
| ------- | ----------------------------------------------------------- |
| `name`  | requerido; primer argumento                                 |
| `style` | `acl` (sólo en `feature`)                                   |
| `path`  | `src/upstream/<name>`, `src/<name>` o `src/features/<name>` |

## Sobre los tests de este paquete

Un paquete de schematics publica **plantillas**, no sólo código, y el runner las
carga desde disco. Por eso la suite de integración corre contra `dist` — probar
el fuente probaría algo que nadie instala. `pnpm verify` compila antes de
testear, que es el orden que esos tests asumen.
