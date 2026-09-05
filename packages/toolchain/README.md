# @ahincho/nova-nestjs-toolchain

Presets de TypeScript, ESLint y Jest compartidos por los proyectos NestJS de
Nova Platform. Un solo paquete de desarrollo; cada preset vive en su carpeta.

```bash
pnpm add -D @ahincho/nova-nestjs-toolchain
```

ESLint, Jest y ts-jest son peers opcionales: se instalan sólo en el proyecto que
usa ese preset.

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
