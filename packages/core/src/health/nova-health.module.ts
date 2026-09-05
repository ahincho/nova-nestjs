import { Module, type DynamicModule } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import {
  createHealthController,
  createLegacyHealthController,
} from './health.controller';
import {
  HEALTH_OPTIONS,
  resolveHealthOptions,
  type NovaHealthModuleOptions,
} from './tokens';

/**
 * Sirve `GET <path>/live`, `GET <path>/ready` y, si se pide, la ruta heredada.
 * Los chequeos corren sobre `@nestjs/terminus`.
 *
 * @example
 * @Module({
 *   imports: [
 *     NovaHealthModule.forRoot({
 *       legacyPath: 'api/v1/health',
 *       gracefulShutdownTimeoutMs: 5000,
 *       readinessChecks: [
 *         { name: 'database', check: () => pool.query('select 1').then(() => true) },
 *       ],
 *     }),
 *   ],
 * })
 * export class AppModule {}
 */
@Module({})
export class NovaHealthModule {
  static forRoot(options: NovaHealthModuleOptions = {}): DynamicModule {
    const resolved = resolveHealthOptions(options);
    const controllers = [createHealthController(resolved.path)];
    if (resolved.legacyPath) {
      controllers.push(createLegacyHealthController(resolved.legacyPath));
    }
    return {
      module: NovaHealthModule,
      imports: [
        TerminusModule.forRoot({
          // terminus imprime un resumen JSON por cada chequeo fallido; acá se
          // apaga porque el controlador ya deja un warn por indicador caído,
          // que es lo que se quiere ver cuando una dependencia parpadea.
          logger: false,
          gracefulShutdownTimeoutMs: resolved.gracefulShutdownTimeoutMs,
        }),
      ],
      controllers,
      providers: [{ provide: HEALTH_OPTIONS, useValue: resolved }],
      exports: [HEALTH_OPTIONS],
    };
  }
}
