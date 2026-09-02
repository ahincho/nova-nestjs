import {
  Controller,
  Get,
  Inject,
  Logger,
  Res,
  type Type,
} from '@nestjs/common';
import { SkipResponseWrapper } from '@ahincho/nova-nestjs-api-standard';
import { HEALTH_OPTIONS, type ResolvedHealthOptions } from './tokens';

export type LivenessResponse = { status: 'ok' };

export type ReadinessResponse = {
  status: 'ok' | 'error';
  checks: Record<string, boolean>;
};

type ResponseLike = {
  status(code: number): unknown;
};

/**
 * Builds the probe controller under the configured path.
 *
 * A factory rather than a plain class because `@Controller(path)` fixes the
 * route at decoration time, and the path has to come from the module options.
 */
export function createHealthController(path: string): Type<unknown> {
  @SkipResponseWrapper()
  @Controller(path)
  class HealthController {
    private readonly logger = new Logger('Health');

    constructor(
      @Inject(HEALTH_OPTIONS)
      private readonly options: ResolvedHealthOptions,
    ) {}

    /**
     * Whether the process is alive. Deliberately answers without touching a
     * dependency: a liveness probe that fails because a database is down gets
     * the container restarted, which does not bring the database back.
     */
    @Get('live')
    live(): LivenessResponse {
      return { status: 'ok' };
    }

    /**
     * Whether the service can take traffic.
     */
    @Get('ready')
    async ready(
      @Res({ passthrough: true }) response: ResponseLike,
    ): Promise<ReadinessResponse> {
      const checks = await this.runChecks();
      const ready = Object.values(checks).every(Boolean);

      if (!ready) {
        // 503 rather than an exception: an exception would travel through the
        // global filter and come back wrapped in the response envelope, and the
        // probe contract is the body shape as much as the status.
        response.status(503);
      }

      return { status: ready ? 'ok' : 'error', checks };
    }

    private async runChecks(): Promise<Record<string, boolean>> {
      const entries = await Promise.all(
        this.options.readinessChecks.map(
          async (check): Promise<[string, boolean]> => [
            check.name,
            await this.runOne(check.name, () => check.check()),
          ],
        ),
      );

      return Object.fromEntries(entries);
    }

    private async runOne(
      name: string,
      check: () => boolean | Promise<boolean>,
    ): Promise<boolean> {
      try {
        return await Promise.race([
          Promise.resolve(check()),
          new Promise<boolean>((resolve) =>
            setTimeout(
              () => resolve(false),
              this.options.checkTimeoutMs,
            ).unref(),
          ),
        ]);
      } catch (cause) {
        // A check that throws is a check that failed. Reported at warn level so
        // a flapping dependency is visible without every probe cycle looking
        // like an outage.
        this.logger.warn(`Readiness check "${name}" failed: ${String(cause)}`);
        return false;
      }
    }
  }

  return HealthController;
}
