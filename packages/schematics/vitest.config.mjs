import { novaVitestConfig } from '@ahincho/nova-nestjs-toolchain/vitest/index.mjs';

export default novaVitestConfig({
  // Este paquete no tiene decoradores ni depende de NestJS, asi que tampoco
  // depende de `reflect-metadata`.
  setupFiles: [],
  // schematics.spec.ts corre la coleccion compilada, que es lo que se instala,
  // asi que su ejecucion no aparece como cobertura del fuente. Lo medible desde
  // el fuente es la parte pura -el nombrado y la decision de ruta-, y de eso se
  // ocupa rules.spec.ts. Los `schema.ts` son solo tipos y no emiten nada.
  coverageExclude: ['**/*.spec.ts', '**/schema.ts'],
});
