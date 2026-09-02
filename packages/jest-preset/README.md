# @ahincho/nova-jest-preset

Preset de Jest compartido por los proyectos NestJS de Nova Platform.

```bash
pnpm add -D @ahincho/nova-jest-preset jest ts-jest
```

```js
// jest.config.js
module.exports = { preset: '@ahincho/nova-jest-preset' };
```

Fija `ts-jest`, el entorno `node`, el patrón `*.spec.ts` y un umbral de cobertura
del 80 %. El umbral vive en el preset para que el número signifique lo mismo en
todos los repos.
