import { TerminusModule } from '@nestjs/terminus';
import { NovaHealthModule } from './nova-health.module';
import {
  DEFAULT_CHECK_TIMEOUT_MS,
  DEFAULT_GRACEFUL_SHUTDOWN_TIMEOUT_MS,
  DEFAULT_HEALTH_PATH,
  HEALTH_OPTIONS,
  resolveHealthOptions,
} from './tokens';

type ValueProvider = { provide: unknown; useValue?: unknown };
type ImportedModule = { module?: unknown };

describe('resolveHealthOptions', () => {
  it('applies the defaults', () => {
    expect(resolveHealthOptions()).toEqual({
      path: DEFAULT_HEALTH_PATH,
      legacyPath: undefined,
      readinessChecks: [],
      readinessIndicators: [],
      checkTimeoutMs: DEFAULT_CHECK_TIMEOUT_MS,
      gracefulShutdownTimeoutMs: DEFAULT_GRACEFUL_SHUTDOWN_TIMEOUT_MS,
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

  it('adds the legacy controller only when a legacy path is given', () => {
    expect(
      NovaHealthModule.forRoot({ legacyPath: 'api/v1/health' }).controllers,
    ).toHaveLength(2);
    expect(NovaHealthModule.forRoot().controllers).toHaveLength(1);
  });

  it('runs the checks on terminus', () => {
    const imports = (NovaHealthModule.forRoot().imports ??
      []) as ImportedModule[];
    expect(imports.some((imported) => imported.module === TerminusModule)).toBe(
      true,
    );
  });

  // Not global on purpose: the probes are routes, and a module that contributes
  // controllers has to be imported where the routes should exist.
  it('is not global', () => {
    expect(NovaHealthModule.forRoot().global).toBeUndefined();
  });
});
