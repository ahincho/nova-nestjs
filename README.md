# nova-nestjs

Meta-framework de **Nova Platform** para NestJS. Monorepo de paquetes publicados
en npm bajo el scope `@nova-platform`.

Es el equivalente en NestJS de lo que
[`nova-java-spring-boot-starter`](https://github.com/ahincho/nova-java-spring-boot-starter)
y [`nova-java-quarkus-parent`](https://github.com/ahincho/nova-java-quarkus-parent)
son en Java, y sigue la misma arquitectura de cinco niveles del
[ADR-001](https://github.com/ahincho/nova-docs).

## Por qué un monorepo y no un repo por paquete

En Java la coordinación de versiones ocurre en el **consumidor**: un BOM se importa
y un parent se hereda. npm no tiene ninguno de los dos mecanismos, sólo
`peerDependencies` con rangos. Entonces la coordinación tiene que ocurrir en el
**productor**, y ese productor es el monorepo.

Es lo que hacen NestJS, Angular y Backstage. Cada paquete se publica con su versión,
su changelog y su página de npm; el consumidor no distingue.

## Paquetes

| Paquete                                                              | Nivel               | Estado    |
| -------------------------------------------------------------------- | ------------------- | --------- |
| [`@nova-platform/api-standard`](packages/api-standard)               | 1 · librería pura   | listo     |
| [`@nova-platform/nestjs-api-standard`](packages/nestjs-api-standard) | 2 · conector NestJS | listo     |
| `@nova-platform/nestjs-config`                                       | 2                   | pendiente |
| `@nova-platform/nestjs-http`                                         | 2                   | pendiente |
| `@nova-platform/nestjs-observability`                                | 2                   | pendiente |
| `@nova-platform/nestjs-health`                                       | 2                   | pendiente |
| `@nova-platform/nestjs`                                              | 3 · agregador       | pendiente |
| [`@nova-platform/tsconfig`](packages/tsconfig)                       | 4 · presets         | listo     |
| [`@nova-platform/eslint-config`](packages/eslint-config)             | 4 · presets         | listo     |
| [`@nova-platform/jest-preset`](packages/jest-preset)                 | 4 · presets         | listo     |
| `@nova-platform/schematics`                                          | 5 · tooling         | pendiente |

El nivel 1 no importa de ningún framework: `api-standard` es TypeScript puro y sirve
igual en un Lambda o en un script.

## Cómo lo consume una aplicación

Tres mecanismos distintos, y sólo uno es un `import`:

```ts
// 1. Piezas sueltas — un import normal
import { ApiResponses } from '@nova-platform/api-standard';

// 2. Activación — en NestJS nada se dispara solo, hay que llamarlo
@Module({ imports: [ApiStandardModule.forRoot()] })
export class AppModule {}
```

```json
// 3. Presets — se heredan desde el archivo de configuración
{ "extends": "@nova-platform/tsconfig/nestjs.json" }
```

## Desarrollo

```bash
pnpm install
pnpm verify
```

| Comando          | Qué hace                                   |
| ---------------- | ------------------------------------------ |
| `pnpm verify`    | build + typecheck + cobertura + formato    |
| `pnpm build`     | compila en orden topológico                |
| `pnpm typecheck` | `tsc --noEmit` incluyendo los `*.spec.ts`  |
| `pnpm test`      | corre la suite de cada paquete             |
| `pnpm test:cov`  | igual, con el umbral de cobertura del 80 % |
| `pnpm changeset` | registra un cambio para el próximo release |

**El build va antes que el typecheck y que los tests.** Un paquete consume a su
hermano por el `dist` que publica, igual que en Java se compila la librería antes
que su consumidor. `pnpm -r` respeta el orden topológico, así que basta con correr
`pnpm build` una vez después de clonar; `pnpm verify` ya lo hace en orden.

## Versionado

Conventional commits y [Changesets](https://github.com/changesets/changesets).
Cada PR que toca un paquete publicable lleva su changeset; `changeset version`
calcula los bumps y `changeset publish` sube a npm.

El stack Java usa `release-please` porque cada repo se versiona solo. Acá el bump
tiene que propagarse entre paquetes del mismo commit, que es justo lo que Changesets
resuelve y `release-please` no.

## Estado

`0.x`: la API todavía se está asentando y habrá cambios que rompen entre minors.
A partir de `1.0.0` el semver es un compromiso.

## Licencia

[EPL-2.0](LICENSE), igual que el resto de Nova Platform.
