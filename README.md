# nova-nestjs

Meta-framework de **Nova Platform** para NestJS. Monorepo de paquetes publicados
en GitHub Packages bajo el scope `@ahincho`.

Es el equivalente en NestJS de lo que
[`nova-java-spring-boot-starter`](https://github.com/ahincho/nova-java-spring-boot-starter)
y [`nova-java-quarkus-parent`](https://github.com/ahincho/nova-java-quarkus-parent)
son en Java. Parte de la arquitectura de cinco niveles del
[ADR-001](https://github.com/ahincho/nova-docs), pero la colapsa en tres
paquetes; el porqué está más abajo.

## Por qué un monorepo y no un repo por paquete

En Java la coordinación de versiones ocurre en el **consumidor**: un BOM se importa
y un parent se hereda. npm no tiene ninguno de los dos mecanismos, sólo
`peerDependencies` con rangos. Entonces la coordinación tiene que ocurrir en el
**productor**, y ese productor es el monorepo.

Es lo que hacen NestJS, Angular y Backstage. Cada paquete se publica con su versión,
su changelog y su página de npm; el consumidor no distingue.

## Paquetes

| Paquete                                           | Qué es                                                                                                             |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| [`@ahincho/nova-nestjs`](packages/core)           | runtime: sobre de respuesta, configuración, cliente HTTP, contexto de request, salud, `NovaModule` y `bootstrap()` |
| [`@ahincho/nova-toolchain`](packages/toolchain)   | presets de TypeScript, ESLint y Jest                                                                               |
| [`@ahincho/nova-schematics`](packages/schematics) | generadores `feature` (bff y acl) y `upstream`                                                                     |

Los tres se publican con **un solo número de versión**, como hace `@nestjs/*`.

### Por qué tres y no once

Hasta la 0.1 eran once: una librería pura, cinco conectores, un agregador, tres
presets y los schematics, siguiendo los cinco niveles al pie de la letra. Nadie
instalaba las piezas sueltas —el servicio de ejemplo ya consumía el agregador— y
cada cambio en `api-standard` arrastraba tres bumps en cascada. Los niveles
existen para separar lo que tiene distinto consumidor o distinto ciclo de vida,
y acá sólo hay dos de esas fronteras: el runtime que una aplicación importa, y
las herramientas que sólo corren en desarrollo. Los schematics quedan aparte
porque Nest CLI resuelve una colección por nombre de paquete.

Dentro de `core` cada módulo conserva su carpeta y su `index.ts`, así que la
frontera sigue visible en el código; lo que desapareció es el costo de
publicarla.

## Cómo lo consume una aplicación

Tres mecanismos distintos, y sólo uno es un `import`:

```ts
// 1. Piezas sueltas — un import normal
import { ApiResponses } from '@ahincho/nova-nestjs';

// 2. Activación — en NestJS nada se dispara solo, hay que llamarlo
@Module({ imports: [ApiStandardModule.forRoot()] })
export class AppModule {}
```

```json
// 3. Presets — se heredan desde el archivo de configuración
{ "extends": "@ahincho/nova-toolchain/tsconfig/nestjs.json" }
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
calcula los bumps y `changeset publish` sube al registry.

El stack Java usa `release-please` porque cada repo se versiona solo. Acá el bump
tiene que propagarse entre paquetes del mismo commit, que es justo lo que Changesets
resuelve y `release-please` no.

## Consumirlos desde otro proyecto

[`nova-nestjs-example`](https://github.com/ahincho/nova-nestjs-example) es el
servicio de referencia y corre siempre contra la última versión publicada. En
corto:

```bash
# .npmrc del proyecto: solo el registry, nunca la credencial
echo '@ahincho:registry=https://npm.pkg.github.com' >> .npmrc

# la credencial va en la configuracion de usuario, una sola vez
pnpm config set "//npm.pkg.github.com/:_authToken" "$(gh auth token)"

pnpm add @ahincho/nova-nestjs
```

Tres cosas que cuestan un rato descubrir solas:

- **GitHub Packages pide token incluso para un paquete público.** No hay forma
  de instalar sin credencial; eso sólo lo da npmjs.
- **La credencial no puede vivir en el `.npmrc` versionado.** pnpm se niega a
  expandir una variable de entorno ahí, porque alguien podría cambiar la URL del
  registry en un pull request y llevarse el token.
- **pnpm rechaza una versión recién publicada.** Es su política de antigüedad
  mínima, pensada para paquetes de terceros; para los propios se excluye el
  scope en `pnpm-workspace.yaml` con `minimumReleaseAgeExclude`.

## Estado

`0.x`: la API todavía se está asentando y habrá cambios que rompen entre minors.
A partir de `1.0.0` el semver es un compromiso.

## Licencia

[EPL-2.0](LICENSE), igual que el resto de Nova Platform.
