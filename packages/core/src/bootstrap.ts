import {
  Logger,
  ValidationPipe,
  type INestApplication,
  type LoggerService,
} from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { validationExceptionFactory } from './api';
import { DEFAULT_HEALTH_PATH } from './health';
import { buildCorsOptions, numberEnv, type CorsPolicyOptions } from './config';

export type BootstrapOptions = {
  /** Defaults to the `PORT` variable, and to 3000 when it is unset. */
  readonly port?: number;

  /**
   * Defaults to `0.0.0.0`. Binding to localhost inside a container makes the
   * service unreachable from the load balancer while looking healthy locally.
   */
  readonly host?: string;

  /** Enables CORS with the given policy. Omit to leave CORS off. */
  readonly cors?: CorsPolicyOptions;

  /** Installed with `app.useLogger()`. Logs are buffered until it is set. */
  readonly logger?: LoggerService;

  /** Prefix applied to every route except the health probes. */
  readonly globalPrefix?: string;

  /**
   * Route prefix of the probes, kept out of `globalPrefix`. Must match what
   * `NovaHealthModule` was given.
   */
  readonly healthPath?: string;
  /**
   * Ruta heredada de salud, también fuera de `globalPrefix`. Debe coincidir
   * con el `legacyPath` que recibió `NovaHealthModule`.
   */
  readonly legacyHealthPath?: string;

  /**
   * Rejects a request carrying a property no DTO declares. On by default: a
   * silently ignored field is how a client believes it sent a filter that the
   * service never applied.
   */
  readonly forbidUnknownProperties?: boolean;
};

/**
 * Starts a Nova service.
 *
 * Replaces the `main.ts` every service was copying, and with it the four
 * decisions that were being made again in each one: how a failed DTO turns into
 * the response envelope, which origins may call, which interface to bind, and
 * that the health probes must not move when a global prefix is added.
 *
 * @example
 * void bootstrap(AppModule, {
 *   cors: { origins: process.env.CORS_ALLOWED_ORIGINS ?? '' },
 * });
 */
export async function bootstrap(
  // Typed loosely on purpose: the concrete parameter of NestFactory.create is
  // an interface of @nestjs/core, and naming it here would force every consumer
  // onto the exact version this package compiled against.
  rootModule: unknown,
  options: BootstrapOptions = {},
): Promise<INestApplication> {
  const app = await NestFactory.create(
    rootModule as Parameters<typeof NestFactory.create>[0],
    { bufferLogs: true },
  );
  // Sin esto el SIGTERM de ECS mata el proceso sin avisar a los módulos: el
  // apagado ordenado de las sondas existe solo si los hooks están activos.
  app.enableShutdownHooks();

  if (options.logger) {
    app.useLogger(options.logger);
  }

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: options.forbidUnknownProperties ?? true,
      transform: true,
      exceptionFactory: validationExceptionFactory,
    }),
  );

  if (options.globalPrefix) {
    const healthPath = options.healthPath ?? DEFAULT_HEALTH_PATH;

    // The probes stay where the target group looks for them. A prefix that
    // quietly moves /health/live to /api/health/live makes the task deregister
    // about nine seconds after it registers, and the deploy dies ten minutes
    // later on a timeout that reads like a resource problem.
    const exclude = [`${healthPath}/live`, `${healthPath}/ready`];
    if (options.legacyHealthPath) {
      exclude.push(options.legacyHealthPath);
    }
    app.setGlobalPrefix(options.globalPrefix, { exclude });
  }

  if (options.cors) {
    // After create(), not inside its options: the allowed origins usually come
    // from configuration, which does not exist until the app does.
    app.enableCors(buildCorsOptions(options.cors));
  }

  const port = options.port ?? numberEnv('PORT', 3000);
  const host = options.host ?? '0.0.0.0';

  await app.listen(port, host);

  new Logger('Bootstrap').log(`Listening on ${host}:${port}`);

  return app;
}
