import { HttpClientService } from './http-client.service';
import { NovaHttpModule } from './nova-http.module';
import {
  DEFAULT_HTTP_TIMEOUT_MS,
  NOVA_HTTP_OPTIONS,
  resolveNovaHttpOptions,
} from './tokens';

type ValueProvider = { provide: unknown; useValue?: unknown };

describe('resolveNovaHttpOptions', () => {
  it('applies the defaults', () => {
    expect(resolveNovaHttpOptions()).toEqual({
      defaultTimeoutMs: DEFAULT_HTTP_TIMEOUT_MS,
      defaultHeaders: {},
    });
  });

  it('keeps the default when a field is explicitly undefined', () => {
    expect(
      resolveNovaHttpOptions({ defaultTimeoutMs: undefined }).defaultTimeoutMs,
    ).toBe(DEFAULT_HTTP_TIMEOUT_MS);
  });

  it('honours a configured timeout', () => {
    expect(
      resolveNovaHttpOptions({ defaultTimeoutMs: 1200 }).defaultTimeoutMs,
    ).toBe(1200);
  });
});

describe('NovaHttpModule.forRoot', () => {
  it('provides the client and its resolved options', () => {
    const module = NovaHttpModule.forRoot({ defaultTimeoutMs: 2000 });
    const providers = (module.providers ?? []) as ValueProvider[];

    expect(providers).toContain(HttpClientService);
    expect(
      providers.find((provider) => provider.provide === NOVA_HTTP_OPTIONS)
        ?.useValue,
    ).toEqual({ defaultTimeoutMs: 2000, defaultHeaders: {} });
  });

  // Global, so a feature module can inject the client without importing this
  // module again in every one of them.
  it('is global and exports the client', () => {
    const module = NovaHttpModule.forRoot();

    expect(module.global).toBe(true);
    expect(module.exports).toEqual([HttpClientService, NOVA_HTTP_OPTIONS]);
  });
});
