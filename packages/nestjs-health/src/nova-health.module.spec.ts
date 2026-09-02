import { NovaHealthModule } from './nova-health.module';
import {
  DEFAULT_CHECK_TIMEOUT_MS,
  DEFAULT_HEALTH_PATH,
  HEALTH_OPTIONS,
  resolveHealthOptions,
} from './tokens';

type ValueProvider = { provide: unknown; useValue?: unknown };

describe('resolveHealthOptions', () => {
  it('applies the defaults', () => {
    expect(resolveHealthOptions()).toEqual({
      path: DEFAULT_HEALTH_PATH,
      readinessChecks: [],
      checkTimeoutMs: DEFAULT_CHECK_TIMEOUT_MS,
    });
  });

  it('keeps a default when a field is explicitly undefined', () => {
    expect(resolveHealthOptions({ path: undefined }).path).toBe(
      DEFAULT_HEALTH_PATH,
    );
  });
});

describe('NovaHealthModule.forRoot', () => {
  it('registers the probe controller and the resolved options', () => {
    const module = NovaHealthModule.forRoot({ checkTimeoutMs: 500 });
    const providers = (module.providers ?? []) as ValueProvider[];

    expect(module.controllers).toHaveLength(1);
    expect(
      providers.find((provider) => provider.provide === HEALTH_OPTIONS)
        ?.useValue,
    ).toMatchObject({ path: 'health', checkTimeoutMs: 500 });
  });

  // Not global on purpose: the probes are routes, and a module that contributes
  // controllers has to be imported where the routes should exist.
  it('is not global', () => {
    expect(NovaHealthModule.forRoot().global).toBeUndefined();
  });
});
