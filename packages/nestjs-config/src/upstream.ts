import { registerAs } from '@nestjs/config';
import { numberEnv, urlEnv } from './environment';

/**
 * Everything a caller needs to reach one upstream service.
 */
export type UpstreamConfig = {
  /** Absolute base URL, without a trailing slash. */
  readonly url: string;
  /** How long a single call may take before it is aborted. */
  readonly timeoutMs: number;
};

export type DefineUpstreamOptions = {
  /**
   * Prefix of the environment variables. Defaults to the upstream name in
   * SCREAMING_SNAKE_CASE, so `academic-orchestrator` reads
   * `ACADEMIC_ORCHESTRATOR_URL` and `ACADEMIC_ORCHESTRATOR_TIMEOUT_MS`.
   */
  readonly envPrefix?: string;

  /** Used when the `_TIMEOUT_MS` variable is not set. Defaults to 5000. */
  readonly defaultTimeoutMs?: number;
};

export const DEFAULT_UPSTREAM_TIMEOUT_MS = 5000;

/**
 * Turns a name into the prefix of its environment variables.
 *
 * Accepts kebab-case, camelCase and snake_case, so the same upstream can be
 * named the way each layer names things without the variables drifting apart.
 */
export function toEnvPrefix(name: string): string {
  return name
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .replace(/[-\s]+/g, '_')
    .toUpperCase();
}

/**
 * Declares one upstream as a configuration namespace.
 *
 * Replaces the per-upstream config file every service used to copy, and moves
 * the failure to boot: a service whose URL was never injected dies on startup
 * naming the variable, instead of answering 500 the first time that route is
 * called - which is how a missing variable survives a green deploy for weeks.
 *
 * @example
 * export const academicOrchestrator = defineUpstream('academic-orchestrator');
 *
 * @Module({
 *   imports: [ConfigModule.forFeature(academicOrchestrator)],
 * })
 * export class AcademicOrchestratorModule {}
 */
export function defineUpstream(
  name: string,
  options: DefineUpstreamOptions = {},
) {
  const prefix = options.envPrefix ?? toEnvPrefix(name);
  const defaultTimeoutMs =
    options.defaultTimeoutMs ?? DEFAULT_UPSTREAM_TIMEOUT_MS;

  return registerAs(name, (): UpstreamConfig => ({
    url: urlEnv(`${prefix}_URL`),
    timeoutMs: numberEnv(`${prefix}_TIMEOUT_MS`, defaultTimeoutMs),
  }));
}
