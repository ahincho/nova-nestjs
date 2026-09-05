export { bootstrap, type BootstrapOptions } from './bootstrap';
export { NovaModule, type NovaModuleOptions } from './nova.module';
// Cada módulo conserva su index.ts como superficie pública y acá se reexporta
// entera: lo que antes se instalaba como seis paquetes hoy se importa de este.
export * from './api-standard';
export * from './api';
export * from './config';
export * from './health';
export * from './http';
export * from './observability';
