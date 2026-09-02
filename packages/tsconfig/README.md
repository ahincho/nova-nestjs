# @nova-platform/tsconfig

Configuraciones de TypeScript compartidas por los proyectos NestJS de Nova Platform.

```bash
pnpm add -D @nova-platform/tsconfig
```

```json
{
  "extends": "@nova-platform/tsconfig/nestjs.json",
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
