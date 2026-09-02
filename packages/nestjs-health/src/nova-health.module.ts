import { Module, type DynamicModule } from '@nestjs/common';
import { createHealthController } from './health.controller';
import {
  HEALTH_OPTIONS,
  resolveHealthOptions,
  type NovaHealthModuleOptions,
} from './tokens';

/**
 * Serves `GET <path>/live` and `GET <path>/ready`.
 *
 * @example
 * @Module({
 *   imports: [
 *     NovaHealthModule.forRoot({
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

    return {
      module: NovaHealthModule,
      controllers: [createHealthController(resolved.path)],
      providers: [{ provide: HEALTH_OPTIONS, useValue: resolved }],
      exports: [HEALTH_OPTIONS],
    };
  }
}
