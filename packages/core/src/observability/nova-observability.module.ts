import {
  Module,
  type DynamicModule,
  type MiddlewareConsumer,
  type NestModule,
  type Provider,
} from '@nestjs/common';
import { RequestContextMiddleware } from './request-context.middleware';
import { RequestContextService } from './request-context.service';
import {
  OBSERVABILITY_OPTIONS,
  resolveObservabilityOptions,
  type NovaObservabilityModuleOptions,
} from './tokens';

/**
 * Opens a request context for every route and exposes it for reading.
 *
 * @example
 * @Module({
 *   imports: [NovaObservabilityModule.forRoot()],
 * })
 * export class AppModule {}
 */
@Module({})
export class NovaObservabilityModule implements NestModule {
  static forRoot(options: NovaObservabilityModuleOptions = {}): DynamicModule {
    const providers: Provider[] = [
      {
        provide: OBSERVABILITY_OPTIONS,
        useValue: resolveObservabilityOptions(options),
      },
      RequestContextService,
    ];

    return {
      module: NovaObservabilityModule,
      global: true,
      providers,
      exports: [RequestContextService, OBSERVABILITY_OPTIONS],
    };
  }

  configure(consumer: MiddlewareConsumer): void {
    // Every route, including the health probes: a probe that fails is exactly
    // the log line someone will want to correlate.
    consumer.apply(RequestContextMiddleware).forRoutes('*path');
  }
}
