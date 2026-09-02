export const HEALTH_OPTIONS = Symbol('NOVA_HEALTH_OPTIONS');

/**
 * One thing readiness depends on.
 *
 * Returning `false` and throwing mean the same to the probe; a check does not
 * have to guard itself.
 */
export type ReadinessCheck = {
  readonly name: string;
  check(): boolean | Promise<boolean>;
};

export type NovaHealthModuleOptions = {
  /**
   * Route prefix of the probes. Defaults to `health`, giving `/health/live`
   * and `/health/ready`.
   *
   * Moving it means moving the load balancer's target group at the same time.
   * A probe that answers 404 deregisters the task about nine seconds after it
   * registers, and the deploy dies ten minutes later on a timeout that reads
   * like a resource problem.
   */
  readonly path?: string;

  /**
   * What readiness depends on. Empty means the service is ready as soon as it
   * is listening.
   */
  readonly readinessChecks?: readonly ReadinessCheck[];

  /**
   * How long a single check may take. Defaults to 2000.
   *
   * A check without a deadline can hang the probe, and a probe that never
   * answers is worse than one that answers "not ready": the balancer waits for
   * its own timeout on every attempt.
   */
  readonly checkTimeoutMs?: number;
};

export type ResolvedHealthOptions = {
  readonly path: string;
  readonly readinessChecks: readonly ReadinessCheck[];
  readonly checkTimeoutMs: number;
};

export const DEFAULT_HEALTH_PATH = 'health';
export const DEFAULT_CHECK_TIMEOUT_MS = 2000;

export function resolveHealthOptions(
  options: NovaHealthModuleOptions = {},
): ResolvedHealthOptions {
  return {
    path: options.path ?? DEFAULT_HEALTH_PATH,
    readinessChecks: options.readinessChecks ?? [],
    checkTimeoutMs: options.checkTimeoutMs ?? DEFAULT_CHECK_TIMEOUT_MS,
  };
}
