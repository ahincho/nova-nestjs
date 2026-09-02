module.exports = {
  preset: '@ahincho/nova-jest-preset',
  // schematics.spec.ts corre la coleccion compilada, que es lo que se instala,
  // asi que su ejecucion no aparece como cobertura del fuente. Lo medible desde
  // el fuente es la parte pura -el nombrado y la decision de ruta-, y de eso se
  // ocupa rules.spec.ts. Los `schema.ts` son solo tipos y no emiten nada.
  collectCoverageFrom: [
    '<rootDir>/src/**/*.ts',
    '!<rootDir>/src/**/*.spec.ts',
    '!<rootDir>/src/index.ts',
    '!<rootDir>/src/**/schema.ts',
  ],
  coverageThreshold: {
    global: { branches: 80, functions: 80, lines: 80, statements: 80 },
  },
};
