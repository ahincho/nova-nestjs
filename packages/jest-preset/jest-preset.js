/**
 * Preset de Jest compartido por los paquetes y las aplicaciones de Nova Platform.
 *
 *   // jest.config.js
 *   module.exports = { preset: '@ahincho/nova-jest-preset' };
 *
 * No declara rootDir ni roots: en un preset, una ruta relativa se resuelve
 * contra el archivo del preset y no contra el proyecto, asi que fijarlos apunta
 * a este paquete. Sin declararlos, Jest usa el directorio del jest.config.js
 * del proyecto, que es lo que se quiere.
 *
 * El umbral de cobertura vive aca a proposito: si cada repo elige el suyo, el
 * numero deja de significar algo al compararlos.
 */
module.exports = {
  testEnvironment: 'node',
  testRegex: '.*\.spec\.ts$',
  transform: {
    // La ruta al tsconfig va explicita: la deteccion automatica de ts-jest
    // arranca del rootDir de Jest, y un preset la deja apuntando al lugar
    // equivocado con un error que se lee como "falta @types/jest".
    '^.+\.ts$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.json' }],
  },
  moduleFileExtensions: ['js', 'json', 'ts'],
  collectCoverageFrom: [
    '<rootDir>/src/**/*.ts',
    '!<rootDir>/src/**/*.spec.ts',
    '!<rootDir>/src/index.ts',
  ],
  coverageDirectory: '<rootDir>/coverage',
  coverageThreshold: {
    global: { branches: 80, functions: 80, lines: 80, statements: 80 },
  },
};
