# @ahincho/nova-nestjs-toolchain

Presets de TypeScript, ESLint y Jest compartidos por los proyectos NestJS de
Nova Platform, **y las herramientas mismas**. Un solo paquete de desarrollo;
cada preset vive en su carpeta.

```bash
pnpm add -D @ahincho/nova-nestjs-toolchain
```

Con eso llegan TypeScript, ESLint, Prettier, Jest, ts-jest, el CLI de NestJS,
`@nestjs/testing`, supertest y los `@types` que hacen falta. Un servicio no
declara ninguno: igual que `@ahincho/nova-nestjs` trae NestJS, éste trae la
herramienta, en las versiones contra las que la plataforma corre su suite.

Antes eran peers opcionales, y eso dejaba la elección en cada repositorio: doce
rangos escritos por servicio que cada equipo podía mover por su cuenta.

## Hace falta una línea en el consumidor

pnpm aísla `node_modules`, así que un paquete que entra por transitividad no se
resuelve ni expone su binario. Sin esto no existen `tsc` ni `jest`, y un
`import` de supertest corta con `TS2307`:

```yaml
# pnpm-workspace.yaml del servicio
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

Es la misma contrapartida que en el runtime: se gana que nadie elija la versión,
se pierde el aislamiento estricto para esos paquetes.

**Los scripts del servicio siguen nombrando la herramienta** (`"test": "jest"`,
`"lint": "eslint ."`), así que cambiar de runner o de linter todavía obliga a
tocar cada `package.json`. Esconderlo detrás de un comando propio -`nova test`,
`nova lint`- es el paso siguiente y todavía no está hecho.

## TypeScript

```json
{
  "extends": "@ahincho/nova-nestjs-toolchain/tsconfig/nestjs.json",
  "compilerOptions": { "outDir": "./dist" }
}
```

| Archivo                | Para qué                                                                                  |
| ---------------------- | ----------------------------------------------------------------------------------------- |
| `tsconfig/base.json`   | reglas comunes: `strict`, `noUncheckedIndexedAccess`, `NodeNext`                          |
| `tsconfig/nestjs.json` | aplicaciones y paquetes NestJS: agrega `experimentalDecorators` y `emitDecoratorMetadata` |

`strictPropertyInitialization` está desactivado sólo en `nestjs.json`: la inyección
por constructor de Nest asigna las propiedades fuera del alcance del compilador.

## ESLint

```js
// eslint.config.mjs
import nova from '@ahincho/nova-nestjs-toolchain/eslint/index.mjs';
export default nova;
```

Para agregar reglas propias sin perder las de la plataforma:

```js
import nova from '@ahincho/nova-nestjs-toolchain/eslint/index.mjs';
export default [...nova, { rules: { 'no-console': 'error' } }];
```

Parte de `recommendedTypeChecked`. Las tres desviaciones están comentadas en el
archivo con su motivo; la que más importa es `no-explicit-any` en `error`, porque
en un BFF un `any` viaja desde la respuesta del upstream hasta el controlador sin
que nadie lo note.

## Jest

```js
// jest.config.js
module.exports = { preset: '@ahincho/nova-nestjs-toolchain/jest' };
```

Fija `ts-jest`, el entorno `node`, el patrón `*.spec.ts` y un umbral de cobertura
del 80 %. El umbral vive en el preset para que el número signifique lo mismo en
todos los repos.

Los `index.ts` quedan fuera del cálculo: un archivo que sólo reexporta compila a
un getter por símbolo, y Istanbul cuenta cada getter como una función que ningún
test llama. Con seis módulos reexportados, eso solo bajaba `core` del 98 % al 74 %.
