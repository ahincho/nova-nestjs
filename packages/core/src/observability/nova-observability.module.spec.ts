import type { MiddlewareConsumer } from '@nestjs/common';
import { NovaObservabilityModule } from './nova-observability.module';
import { RequestContextMiddleware } from './request-context.middleware';
import { RequestContextService } from './request-context.service';
import { OBSERVABILITY_OPTIONS } from './tokens';

type ValueProvider = { provide?: unknown; useValue?: unknown };

describe('NovaObservabilityModule', () => {
  describe('forRoot', () => {
    it('provides the context service and the resolved options', () => {
      const module = NovaObservabilityModule.forRoot({ echoRequestId: false });
      const providers = (module.providers ?? []) as ValueProvider[];

      expect(providers).toContain(RequestContextService);
      expect(
        providers.find((provider) => provider.provide === OBSERVABILITY_OPTIONS)
          ?.useValue,
      ).toMatchObject({ echoRequestId: false });
    });

    // Global, because everything that logs or calls an upstream reads the
    // context, and importing this in every feature module would be noise.
    it('is global and exports the context service', () => {
      const module = NovaObservabilityModule.forRoot();

      expect(module.global).toBe(true);
      expect(module.exports).toEqual([
        RequestContextService,
        OBSERVABILITY_OPTIONS,
      ]);
    });
  });

  describe('configure', () => {
    // Including the probes: a probe that fails is exactly the log line someone
    // will want to correlate.
    it('applies the middleware to every route', () => {
      const forRoutes = jest.fn();
      const consumer = {
        apply: jest.fn().mockReturnValue({ forRoutes }),
      } as unknown as MiddlewareConsumer;

      new NovaObservabilityModule().configure(consumer);

      expect(consumer.apply).toHaveBeenCalledWith(RequestContextMiddleware);
      expect(forRoutes).toHaveBeenCalledWith('*path');
    });
  });
});
