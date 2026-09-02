import { Logger } from '@nestjs/common';
import { SKIP_RESPONSE_WRAPPER } from '@ahincho/nova-nestjs-api-standard';
import {
  createHealthController,
  type ReadinessResponse,
} from './health.controller';
import { resolveHealthOptions, type NovaHealthModuleOptions } from './tokens';

type Controller = {
  live(): { status: string };
  ready(response: {
    status(code: number): unknown;
  }): Promise<ReadinessResponse>;
};

function controller(options: NovaHealthModuleOptions = {}): Controller {
  const HealthController = createHealthController(options.path ?? 'health');
  const Constructor = HealthController as new (options: unknown) => Controller;

  return new Constructor(resolveHealthOptions(options));
}

describe('the health controller', () => {
  beforeEach(() => {
    jest.spyOn(Logger.prototype, 'warn').mockImplementation();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  // The load balancer checks the body shape, and the envelope would turn
  // { status: 'ok' } into { data: { status: 'ok' } } while the status stayed
  // 200 - so nothing would reveal the change until a probe started failing.
  it('is exempt from the response envelope', () => {
    const HealthController = createHealthController('health');

    expect(Reflect.getMetadata(SKIP_RESPONSE_WRAPPER, HealthController)).toBe(
      true,
    );
  });

  describe('liveness', () => {
    // A liveness probe that fails because a database is down gets the container
    // restarted, which does not bring the database back.
    it('answers without touching any dependency', () => {
      const failing = controller({
        readinessChecks: [
          {
            name: 'database',
            check: () => {
              throw new Error('should never be called');
            },
          },
        ],
      });

      expect(failing.live()).toEqual({ status: 'ok' });
    });
  });

  describe('readiness', () => {
    it('is ready with no checks registered', async () => {
      const status = jest.fn();

      await expect(controller().ready({ status })).resolves.toEqual({
        status: 'ok',
        checks: {},
      });
      expect(status).not.toHaveBeenCalled();
    });

    it('reports every check by name', async () => {
      const status = jest.fn();

      const result = await controller({
        readinessChecks: [
          { name: 'database', check: () => true },
          { name: 'cache', check: () => Promise.resolve(true) },
        ],
      }).ready({ status });

      expect(result).toEqual({
        status: 'ok',
        checks: { database: true, cache: true },
      });
    });

    it('answers 503 when one check fails', async () => {
      const status = jest.fn();

      const result = await controller({
        readinessChecks: [
          { name: 'database', check: () => true },
          { name: 'cache', check: () => false },
        ],
      }).ready({ status });

      expect(status).toHaveBeenCalledWith(503);
      expect(result).toEqual({
        status: 'error',
        checks: { database: true, cache: false },
      });
    });

    it('treats a check that throws as a failure', async () => {
      const status = jest.fn();

      const result = await controller({
        readinessChecks: [
          {
            name: 'database',
            check: () => Promise.reject(new Error('ECONNREFUSED')),
          },
        ],
      }).ready({ status });

      expect(result.checks['database']).toBe(false);
      expect(status).toHaveBeenCalledWith(503);
    });

    // A probe that never answers is worse than one that says "not ready": the
    // balancer waits for its own timeout on every attempt.
    it('fails a check that outlives its deadline', async () => {
      const status = jest.fn();

      const result = await controller({
        checkTimeoutMs: 10,
        readinessChecks: [
          { name: 'slow', check: () => new Promise<boolean>(() => undefined) },
        ],
      }).ready({ status });

      expect(result.checks['slow']).toBe(false);
    });

    it('runs the checks concurrently rather than one after another', async () => {
      const status = jest.fn();
      const delayed = (ms: number) => () =>
        new Promise<boolean>((resolve) => setTimeout(() => resolve(true), ms));

      const started = Date.now();
      await controller({
        readinessChecks: [
          { name: 'a', check: delayed(40) },
          { name: 'b', check: delayed(40) },
          { name: 'c', check: delayed(40) },
        ],
      }).ready({ status });

      expect(Date.now() - started).toBeLessThan(110);
    });
  });
});
