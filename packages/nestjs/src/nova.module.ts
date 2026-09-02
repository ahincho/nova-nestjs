import { Module, type DynamicModule, type Provider } from '@nestjs/common';
import {
  ApiStandardModule,
  type ApiStandardModuleOptions,
} from '@ahincho/nova-nestjs-api-standard';
import {
  NovaConfigModule,
  type NovaConfigModuleOptions,
} from '@ahincho/nova-nestjs-config';
import {
  NovaHealthModule,
  type NovaHealthModuleOptions,
} from '@ahincho/nova-nestjs-health';
import {
  NovaHttpModule,
  OUTBOUND_HEADERS_PROVIDER,
  type NovaHttpModuleOptions,
} from '@ahincho/nova-nestjs-http';
import {
  NovaObservabilityModule,
  RequestContextService,
  type NovaObservabilityModuleOptions,
} from '@ahincho/nova-nestjs-observability';

export type NovaModuleOptions = {
  /** Configuration and the upstreams to load. Omit to configure it yourself. */
  readonly config?: NovaConfigModuleOptions;

  /** Response envelope and global exception filter. */
  readonly apiStandard?: ApiStandardModuleOptions;

  /** Request context and correlation headers. */
  readonly observability?: NovaObservabilityModuleOptions;

  /** Outbound HTTP client. */
  readonly http?: NovaHttpModuleOptions;

  /** Liveness and readiness probes. */
  readonly health?: NovaHealthModuleOptions;
};

/**
 * Everything a Nova service gets, in one import.
 *
 * Spring Boot activates a starter by finding it on the classpath. NestJS has no
 * classpath scan, so this call is the activation: it is the whole surface where
 * the platform's behaviour gets turned on.
 *
 * The part no application should have to write itself is the last binding here.
 * `nestjs-http` declares that it wants outbound headers from somewhere, and
 * `nestjs-observability` knows what the current request is. Neither imports the
 * other - this module is where they meet, which is what keeps the two usable on
 * their own.
 *
 * @example
 * @Module({
 *   imports: [
 *     NovaModule.forRoot({
 *       config: { load: [academicOrchestrator] },
 *       health: { readinessChecks: [databaseCheck] },
 *     }),
 *     CoursesModule,
 *   ],
 * })
 * export class AppModule {}
 */
@Module({})
export class NovaModule {
  static forRoot(options: NovaModuleOptions = {}): DynamicModule {
    const imports: DynamicModule['imports'] = [
      ApiStandardModule.forRoot(options.apiStandard),
      NovaObservabilityModule.forRoot(options.observability),
      NovaHttpModule.forRoot(options.http),
      NovaHealthModule.forRoot(options.health),
    ];

    if (options.config) {
      imports.unshift(NovaConfigModule.forRoot(options.config));
    }

    const providers: Provider[] = [
      // The binding that makes a correlation id travel with no call site
      // passing it: the client asks its port for headers, and the port is the
      // context of the request in flight.
      {
        provide: OUTBOUND_HEADERS_PROVIDER,
        useExisting: RequestContextService,
      },
    ];

    return {
      module: NovaModule,
      global: true,
      imports,
      providers,
      // Only the binding this module owns. The four sub-modules declare
      // themselves global, so what they export is already visible everywhere
      // and re-exporting it here would add nothing - and `exports` cannot
      // carry the configuration module anyway, which resolves as a promise.
      exports: [OUTBOUND_HEADERS_PROVIDER],
    };
  }
}
