module.exports = {
  preset: '@nova-platform/jest-preset',
  // Los decoradores de Nest escriben metadata con Reflect antes de que corra
  // ningun test; sin el polyfill cargado, SetMetadata falla al importar.
  setupFiles: ['reflect-metadata'],
};
