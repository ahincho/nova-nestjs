---
'@ahincho/nova-nestjs': minor
---

NestJS deja de ser `peerDependencies` y pasa a ser **dependencia del paquete**. Un
servicio declara `@ahincho/nova-nestjs` y nada más: `@nestjs/common`, `@nestjs/core`,
`@nestjs/config`, `@nestjs/platform-express`, `@nestjs/terminus`, `class-validator`,
`class-transformer`, `reflect-metadata` y `rxjs` llegan con él, en las versiones
contra las que la plataforma corre su suite.

Con peers, la elección de versión vivía en cada repositorio: ocho rangos que cada
equipo podía mover por su cuenta. Ahora la versión está adentro del paquete, así que
subir NestJS es publicar la plataforma.

**Requiere una línea en el `pnpm-workspace.yaml` del servicio.** pnpm aísla
`node_modules`, así que un paquete transitivo no se puede importar; sin esto,
`import { Module } from '@nestjs/common'` corta con `TS2307`:

```yaml
publicHoistPattern:
  - '@nestjs/*'
  - rxjs
  - reflect-metadata
  - class-validator
  - class-transformer
```

Un servicio que siga declarando las suyas no se rompe: pnpm resuelve una sola copia
mientras los rangos se crucen. Lo que cambia es que ya no hace falta, y que dejar de
declararlas es lo que quita la decisión del lado del servicio.
