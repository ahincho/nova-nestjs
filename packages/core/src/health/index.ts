export {
  createHealthController,
  createLegacyHealthController,
} from './health.controller';
export { NovaHealthModule } from './nova-health.module';
export {
  DEFAULT_CHECK_TIMEOUT_MS,
  DEFAULT_GRACEFUL_SHUTDOWN_TIMEOUT_MS,
  DEFAULT_HEALTH_PATH,
  HEALTH_OPTIONS,
  resolveHealthOptions,
  type NovaHealthModuleOptions,
  type ReadinessCheck,
  type ResolvedHealthOptions,
} from './tokens';
// Los tipos de terminus que aparecen en la API pública, reexportados para que
// una aplicación no tenga que importar terminus solo para tiparlos.
export type {
  HealthCheckResult,
  HealthIndicatorFunction,
} from '@nestjs/terminus';
