import { OUTBOUND_HEADERS_PROVIDER } from '@nova-platform/nestjs-http';
import { RequestContextService } from '@nova-platform/nestjs-observability';
import { NovaModule } from './nova.module';

type ExistingProvider = { provide: unknown; useExisting?: unknown };

function providersOf(module: { providers?: unknown[] }): ExistingProvider[] {
  return (module.providers ?? []) as ExistingProvider[];
}

describe('NovaModule.forRoot', () => {
  it('composes the four always-on modules', () => {
    const module = NovaModule.forRoot();

    expect(module.imports).toHaveLength(4);
  });

  // This is the binding no application should have to write: nestjs-http asks
  // its port for outbound headers, and the port is the request context.
  it('binds the outbound headers port to the request context', () => {
    const binding = providersOf(NovaModule.forRoot()).find(
      (provider) => provider.provide === OUTBOUND_HEADERS_PROVIDER,
    );

    expect(binding?.useExisting).toBe(RequestContextService);
  });

  it('adds the configuration module only when asked', () => {
    expect(NovaModule.forRoot().imports).toHaveLength(4);
    expect(NovaModule.forRoot({ config: { load: [] } }).imports).toHaveLength(
      5,
    );
  });

  // Only the binding this module owns: the sub-modules are global, so what
  // they export is already visible everywhere.
  it('exports the headers port', () => {
    expect(NovaModule.forRoot().exports).toEqual([OUTBOUND_HEADERS_PROVIDER]);
  });

  // Global, so a feature module injects the client or the context without
  // importing the platform again in every one of them.
  it('is global', () => {
    expect(NovaModule.forRoot().global).toBe(true);
  });
});
