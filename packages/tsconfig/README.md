# @ahincho/nova-tsconfig

Configuraciones de TypeScript compartidas por los proyectos NestJS de Nova Platform.

```bash
pnpm add -D @ahincho/nova-tsconfig
```

```json
{
  "extends": "@ahincho/nova-tsconfig/nestjs.json",
  "compilerOptions": { "outDir": "./dist" }
}
```

| Archivo        | Para qué                                                                                  |
| -------------- | ----------------------------------------------------------------------------------------- |
| `base.json`    | reglas comunes: `strict`, `noUncheckedIndexedAccess`, `NodeNext`                          |
| `library.json` | librerías sin decoradores                                                                 |
| `nestjs.json`  | aplicaciones y paquetes NestJS: agrega `experimentalDecorators` y `emitDecoratorMetadata` |

`strictPropertyInitialization` está desactivado sólo en `nestjs.json`: la inyección
por constructor de Nest asigna las propiedades fuera del alcance del compilador.
