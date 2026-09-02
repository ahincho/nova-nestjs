import { EnvironmentError } from './environment';
import {
  DEFAULT_UPSTREAM_TIMEOUT_MS,
  defineUpstream,
  toEnvPrefix,
  type UpstreamConfig,
} from './upstream';

describe('toEnvPrefix', () => {
  it.each([
    ['academic-orchestrator', 'ACADEMIC_ORCHESTRATOR'],
    ['academicOrchestrator', 'ACADEMIC_ORCHESTRATOR'],
    ['academic_orchestrator', 'ACADEMIC_ORCHESTRATOR'],
    ['courses', 'COURSES'],
  ])('turns %s into %s', (name, expected) => {
    expect(toEnvPrefix(name)).toBe(expected);
  });
});

describe('defineUpstream', () => {
  const URL_VAR = 'ACADEMIC_ORCHESTRATOR_URL';
  const TIMEOUT_VAR = 'ACADEMIC_ORCHESTRATOR_TIMEOUT_MS';

  afterEach(() => {
    delete process.env[URL_VAR];
    delete process.env[TIMEOUT_VAR];
    delete process.env['CUSTOM_URL'];
  });

  it('reads the URL and the timeout from the derived variables', () => {
    process.env[URL_VAR] = 'http://academic.internal:8080';
    process.env[TIMEOUT_VAR] = '2500';

    const config = defineUpstream('academic-orchestrator')() as UpstreamConfig;

    expect(config).toEqual({
      url: 'http://academic.internal:8080',
      timeoutMs: 2500,
    });
  });

  it('applies the default timeout when the variable is absent', () => {
    process.env[URL_VAR] = 'http://academic.internal:8080';

    const config = defineUpstream('academic-orchestrator')() as UpstreamConfig;

    expect(config.timeoutMs).toBe(DEFAULT_UPSTREAM_TIMEOUT_MS);
  });

  it('honours a per-upstream default timeout', () => {
    process.env[URL_VAR] = 'http://academic.internal:8080';

    const config = defineUpstream('academic-orchestrator', {
      defaultTimeoutMs: 12_000,
    })() as UpstreamConfig;

    expect(config.timeoutMs).toBe(12_000);
  });

  it('accepts an explicit prefix when the variable does not follow the name', () => {
    process.env['CUSTOM_URL'] = 'http://legacy.internal';

    const config = defineUpstream('academic-orchestrator', {
      envPrefix: 'CUSTOM',
    })() as UpstreamConfig;

    expect(config.url).toBe('http://legacy.internal');
  });

  // This is the whole point of declaring the upstream: a service whose URL was
  // never injected dies at boot naming the variable, instead of answering 500
  // the first time that route is called - which is how a missing variable
  // survives a green deploy for weeks.
  it('fails when the URL was never injected', () => {
    expect(() => defineUpstream('academic-orchestrator')()).toThrow(
      EnvironmentError,
    );
    expect(() => defineUpstream('academic-orchestrator')()).toThrow(URL_VAR);
  });

  it('registers the namespace under the upstream name', () => {
    process.env[URL_VAR] = 'http://academic.internal:8080';

    expect(defineUpstream('academic-orchestrator').KEY).toBe(
      'CONFIGURATION(academic-orchestrator)',
    );
  });
});
