import { Module, type DynamicModule, type Provider } from '@nestjs/common';
import { HttpClientService } from './http-client.service';
import {
  NOVA_HTTP_OPTIONS,
  resolveNovaHttpOptions,
  type NovaHttpModuleOptions,
} from './tokens';

/**
 * Registers the outbound HTTP client.
 *
 * @example
 * @Module({
 *   imports: [NovaHttpModule.forRoot({ defaultTimeoutMs: 3000 })],
 * })
 * export class AppModule {}
 */
@Module({})
export class NovaHttpModule {
  static forRoot(options: NovaHttpModuleOptions = {}): DynamicModule {
    const providers: Provider[] = [
      { provide: NOVA_HTTP_OPTIONS, useValue: resolveNovaHttpOptions(options) },
      HttpClientService,
    ];

    return {
      module: NovaHttpModule,
      global: true,
      providers,
      exports: [HttpClientService, NOVA_HTTP_OPTIONS],
    };
  }
}
