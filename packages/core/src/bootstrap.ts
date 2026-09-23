import {
  Logger,
  ValidationPipe,
  type INestApplication,
  type LoggerService,
  type RouteConflictPolicy,
} from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { Logger as PinoLogger } from 'nestjs-pino';
import { validationExceptionFactory } from './api';
import { DEFAULT_HEALTH_PATH } from './health';
import {
  buildCorsOptions,
  numberEnv,
  unfoldSecrets,
  type CorsPolicyOptions,
  type UnfoldSecretsOptions,
} from './config';
import { setupOpenApi, type OpenApiOptions } from './openapi';

/**
 * Variables de las que sale el puerto, en orden de preferencia.
 *
 * `APP_PORT` primero porque es la que inyecta la task definition a partir del
 * puerto del contenedor, o sea la que operaciones puede mover sin tocar la
 * imagen; `PORT` es la que fija el Dockerfile y queda como respaldo.
 */
export const DEFAULT_PORT_VARIABLES = ['APP_PORT', 'PORT'] as const;

/** Puerto cuando ninguna de esas variables está puesta. */
export const DEFAULT_PORT = 3000;

export type BootstrapOptions = {
  /**
   * Puerto explícito. Omitirlo lo lee de {@link BootstrapOptions.portVariables}.
   */
  readonly port?: number;

  /**
   * De qué variables se lee el puerto, en orden. Por defecto
   * {@link DEFAULT_PORT_VARIABLES}. Gana la primera que esté puesta, y si su
   * valor no es un número el arranque corta nombrándola.
   */
  readonly portVariables?: readonly string[];

  /**
   * Desdobla los secretos que la plataforma inyecta como JSON, antes de que
   * exista la aplicación.
   *
   * `true` los descubre por convención — cualquier variable que empiece con
   * `SECRET_`, más las que nombre `NOVA_SECRETS` en tiempo de ejecución. Un
   * objeto ajusta esa convención sin enumerar nada. Omitirlo lo deja apagado.
   *
   * No viene encendido porque descubrir por prefijo sobre un entorno que la
   * plataforma no conoce puede toparse con una variable que se llama así y no
   * es un secreto JSON, y eso cortaría un arranque que hoy funciona. Un
   * servicio nuevo lo declara en una palabra.
   */
  readonly secrets?: UnfoldSecretsOptions | boolean;

  /**
   * Defaults to `0.0.0.0`. Binding to localhost inside a container makes the
   * service unreachable from the load balancer while looking healthy locally.
   */
  readonly host?: string;

  /** Enables CORS with the given policy. Omit to leave CORS off. */
  readonly cors?: CorsPolicyOptions;

  /**
   * Instalado con `app.useLogger()`. Los logs quedan en buffer hasta entonces.
   *
   * Omitirlo usa el logger estructurado que monta `NovaObservabilityModule`, que
   * es lo que corresponde: pasar uno acá es para el servicio que loguea de otra
   * forma, y en ese caso conviene además apagar el de la plataforma con
   * `observability: { logger: false }`.
   */
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

  /**
   * Qué hacer con dos rutas que se pisan, detectado al arrancar. NestJS trae
   * las dos en `'off'`; la plataforma sube `duplicate` a error y `shadow` a
   * aviso. Se puede bajar, pero conviene leer el motivo en {@link bootstrap}
   * antes.
   */
  readonly routeConflicts?: RouteConflictPolicy;

  /**
   * Publica el documento OpenAPI y su interfaz. Omitir la deja apagada: un
   * servicio interno puede no querer exponerla, y esa decisión es de quien lo
   * despliega, no de la plataforma.
   */
  readonly openapi?: OpenApiOptions;
};

/**
 * Una ruta duplicada -mismo método, ruta, host y versión- es siempre un error:
 * uno de los dos manejadores es código muerto y cuál gana depende del orden de
 * registro. Falla al arrancar, que es donde se ve, y no en la primera petición
 * que cae en el equivocado.
 *
 * Una ruta ensombrecida -`/users/me` contra `/users/:id`- a veces es
 * deliberada, así que avisa en vez de cortar.
 */
const DEFAULT_ROUTE_CONFLICTS: RouteConflictPolicy = {
  duplicate: 'error',
  shadow: 'warn',
};

/**
 * Normaliza la opción `secrets` y desdobla. Devuelve qué variables traían uno.
 */
function unfoldSecretsFrom(
  secrets: UnfoldSecretsOptions | boolean | undefined,
): string[] {
  if (secrets === undefined || secrets === false) {
    return [];
  }
  return unfoldSecrets(secrets === true ? {} : secrets);
}

/**
 * El logger estructurado que montó `NovaObservabilityModule`, si está.
 *
 * Se resuelve del contenedor en vez de construirse acá para que sea el mismo
 * que inyectan los servicios: dos instancias significan dos configuraciones que
 * pueden separarse sin que nadie lo note. Devuelve `undefined` cuando el módulo
 * no está montado -porque el servicio apagó el logger de la plataforma-, y ahí
 * queda el de Nest.
 */
function platformLogger(app: INestApplication): LoggerService | undefined {
  try {
    return app.get(PinoLogger, { strict: false });
  } catch {
    return undefined;
  }
}

/**
 * El puerto donde escuchar, de la primera variable que esté puesta.
 *
 * @throws {EnvironmentError} cuando esa variable no es un número. Se valida la
 * que se encontró y no la lista entera, para que el mensaje nombre la que hay
 * que arreglar.
 */
function resolvePort(variables: readonly string[]): number {
  for (const name of variables) {
    const raw = process.env[name];
    if (raw !== undefined && raw.trim() !== '') {
      return numberEnv(name);
    }
  }
  return DEFAULT_PORT;
}

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
  // Antes de crear la aplicación, no después: cada `registerAs` valida sus
  // variables cuando se instancia su módulo, así que para entonces las claves
  // del secreto ya tienen que estar en el entorno.
  const unfolded = unfoldSecretsFrom(options.secrets);

  const app = await NestFactory.create(
    rootModule as Parameters<typeof NestFactory.create>[0],
    {
      bufferLogs: true,
      routeConflictPolicy: options.routeConflicts ?? DEFAULT_ROUTE_CONFLICTS,
      // La otra mitad del apagado ordenado. `enableShutdownHooks` avisa a los
      // módulos; esto decide qué contesta el proceso mientras se apaga.
      //
      // Actúa sobre las conexiones **ya establecidas**: una petición que llega
      // por una que sigue abierta recibe 503, y las que estaban en vuelo
      // terminan. Una conexión TCP nueva, en cambio, se rechaza antes de que
      // exista una petición HTTP que contestar, porque el listener ya dejó de
      // aceptar: ahí lo que se ve es un connection refused, no un 503.
      //
      // Para el caso que importa es lo correcto, porque un balanceador mantiene
      // la conexión abierta y necesita el 503 para sacar la tarea de rotación.
      // Medido: cierre en t=1200 ms, la petición en vuelo terminó 200 a los
      // 3021 ms y la nueva sobre la misma conexión recibió 503.
      return503OnClosing: true,
    },
  );
  // Sin esto el SIGTERM de ECS mata el proceso sin avisar a los módulos: el
  // apagado ordenado de las sondas existe solo si los hooks están activos.
  app.enableShutdownHooks();

  const logger = options.logger ?? platformLogger(app);
  if (logger) {
    app.useLogger(logger);
  }

  // Después de instalar el logger, para que la línea salga en el mismo formato
  // que el resto. Nombra las variables y **nunca su contenido**: es la respuesta
  // a «¿este contenedor recibió el secreto?», que es la primera pregunta cuando
  // una credencial no aparece.
  if (unfolded.length > 0) {
    new Logger('Secrets').log(`Unfolded ${unfolded.join(', ')}`);
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

  // Después del prefijo global, porque `useGlobalPrefix` lo necesita puesto, y
  // antes de escuchar, para que el documento exista desde la primera petición.
  if (options.openapi && (options.openapi.enabled ?? true)) {
    setupOpenApi(app, options.openapi);
  }

  const port =
    options.port ??
    resolvePort(options.portVariables ?? DEFAULT_PORT_VARIABLES);
  const host = options.host ?? '0.0.0.0';

  await app.listen(port, host);

  new Logger('Bootstrap').log(`Listening on ${host}:${port}`);

  return app;
}
