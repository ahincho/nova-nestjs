import { novaVitestConfig } from '@ahincho/nova-nestjs-toolchain/vitest/index.mjs';

export default novaVitestConfig({
  // Un solo archivo de configuración para las dos ubicaciones. La única
  // diferencia entre un spec unitario y uno de punta a punta es donde vive.
  include: ['src/**/*.spec.ts', 'test/**/*.e2e-spec.ts'],
  // `main.ts` queda fuera de la medicion: es el punto de entrada y solo se
  // ejercita arrancando el proceso de verdad. Dejarlo dentro obligaria a bajar
  // el umbral, y entonces el número dejaria de significar lo mismo que en el
  // resto de los servicios.
  coverageExclude: ['**/*.spec.ts', 'src/main.ts'],
});
