---
'@ahincho/nova-nestjs-toolchain': minor
---

El toolchain deja de pedir las herramientas como peers y **las trae**. Instalarlo
alcanza para compilar, probar, revisar y formatear: TypeScript, ESLint, Prettier,
Jest, ts-jest, el CLI de NestJS, `@nestjs/schematics`, `@nestjs/testing`, supertest
y los `@types` de node, jest y supertest.

Es el mismo movimiento que se hizo en el runtime. Con peers opcionales la elección
de versión vivía en cada repositorio: doce rangos escritos por servicio que cada
equipo podía mover por su cuenta. Ahora un servicio declara este paquete y ya.

**Requiere ampliar el `publicHoistPattern` del servicio**, porque pnpm no resuelve
un paquete transitivo ni expone su binario:

```yaml
publicHoistPattern:
  - '@nestjs/*'
  - '@types/*'
  - typescript
  - jest
  - ts-jest
  - eslint
  - prettier
  - supertest
```

Los scripts del servicio siguen nombrando la herramienta (`"test": "jest"`), así
que cambiar de runner todavía obliga a tocar cada `package.json`. Esconderlo
detrás de un comando propio es el paso siguiente.
