import {
  Catch,
  HttpException,
  HttpStatus,
  Inject,
  Logger,
  Optional,
  type ArgumentsHost,
  type ExceptionFilter,
} from '@nestjs/common';
import {
  NOVA_ERROR_CATALOG,
  NovaEnvelopeStandard,
  errorCodeFor,
  errorItem,
  type ApiFailure,
  type ApiStandard,
} from '../../api-standard';
import { ValidationException } from '../exceptions/validation.exception';
import {
  API_STANDARD,
  API_STANDARD_OPTIONS,
  type ResolvedApiStandardOptions,
} from '../tokens';

/**
 * The slice of the platform response object this filter uses.
 *
 * Typed structurally so the package does not depend on `@types/express`.
 */
type HttpResponseLike = {
  status(code: number): { json(body: unknown): unknown };
  setHeader?(name: string, value: string): unknown;
};

type HttpRequestLike = {
  readonly id?: string;
  readonly url?: string;
  readonly method?: string;
};

/**
 * Los campos que una excepción quiere en su línea de log, si trae alguno.
 *
 * Se leen por su forma y no por su clase, para que este filtro no dependa del
 * módulo que la lanza: el cliente HTTP pone ahí la clasificación del fallo de
 * upstream, y el día que otro módulo necesite lo mismo no hay que tocar el
 * filtro. Lo que llega acá va al log y nunca al cuerpo.
 */
function logFieldsOf(exception: unknown): Record<string, unknown> {
  if (typeof exception !== 'object' || exception === null) {
    return {};
  }

  const { logFields } = exception as { logFields?: unknown };

  return typeof logFields === 'object' && logFields !== null
    ? { ...(logFields as Record<string, unknown>) }
    : {};
}

/**
 * El mensaje de la línea de log: el de la excepción, sin el stack.
 *
 * El stack va en `err`. Pegado al mensaje hacía única cada línea, y agrupar por
 * mensaje en el índice dejaba de servir justo para los errores. El de una
 * excepción de la plataforma es estable por tipo -«Upstream service timed
 * out»-, así que agrupa.
 */
function logMessageOf(exception: unknown): string {
  if (exception instanceof Error && exception.message !== '') {
    return exception.message;
  }

  if (typeof exception === 'string' && exception !== '') {
    return exception;
  }

  return 'Unhandled exception';
}

/**
 * Catches every unhandled exception and answers with the active standard.
 *
 * El reparto con el estándar es la razón de ser de este filtro. Acá se decide
 * **qué se puede decir**: el status de cada excepción, que un 5xx no lleve ni
 * su mensaje ni su código de dominio, qué campos fallaron en una validación. El
 * estándar recibe eso ya decidido y sólo le da forma, así que un estándar mal
 * escrito no tiene de dónde filtrar lo que este filtro le quitó.
 *
 * Logs through Nest's own `Logger`, so an application that installed a logger
 * with `app.useLogger()` gets these entries in its own format without this
 * package depending on any logging library.
 *
 * Los argumentos van con la forma de pino -los campos primero, el mensaje
 * después-, que es como los lee el logger de la plataforma. Con la forma del
 * `ConsoleLogger` de Nest, `error(campos, stack)`, pino toma el segundo
 * argumento como mensaje, y el stack terminaba en `msg`.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  constructor(
    @Inject(API_STANDARD_OPTIONS)
    private readonly options: ResolvedApiStandardOptions,
    // Opcional por la misma razón que en el interceptor: instanciarlo a mano
    // sigue contestando con el sobre de Nova.
    @Optional()
    @Inject(API_STANDARD)
    private readonly standard: ApiStandard = new NovaEnvelopeStandard(),
  ) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    if (host.getType() !== 'http') {
      // Nothing to answer on. Reported rather than swallowed, because a
      // silent drop here looks like the handler simply never ran.
      this.logger.error(
        { err: exception },
        'Unhandled exception outside an HTTP context',
      );
      return;
    }

    const context = host.switchToHttp();
    const request = context.getRequest<HttpRequestLike>();
    const failure = this.failureOf(exception, request);

    this.log(exception, failure, request);

    const wire = this.standard.failure(failure);
    const response = context.getResponse<HttpResponseLike>();

    // Antes de `json()`: Express sólo pone `application/json` cuando nadie
    // puso otro, así que un `application/problem+json` sobrevive.
    if (wire.contentType !== undefined) {
      response.setHeader?.('Content-Type', wire.contentType);
    }

    response.status(failure.status).json(wire.body);
  }

  private statusOf(exception: unknown): number {
    return exception instanceof HttpException
      ? exception.getStatus()
      : HttpStatus.INTERNAL_SERVER_ERROR;
  }

  private failureOf(exception: unknown, request: HttpRequestLike): ApiFailure {
    const status = this.statusOf(exception);
    const traceId = request.id;

    // Anything that is not an HttpException arrives here as a 500, so folding
    // the two conditions is what makes the rest of this method total: below
    // this line the exception is always an HttpException under 500.
    //
    // Es la regla que ningún estándar puede tocar: el mensaje sale del que se
    // configuró y el código queda vacío. Si viajara el `errorCode` de la
    // excepción, un 5xx contaría qué falló por dentro.
    if (status >= 500 || !(exception instanceof HttpException)) {
      return {
        status,
        kind: 'internal',
        traceId,
        errors: [
          {
            code: undefined,
            message: this.options.internalErrorMessage,
            field: null,
          },
        ],
      };
    }

    if (exception instanceof ValidationException) {
      return {
        status,
        kind: 'validation',
        traceId,
        errors: exception.violations.map((violation) => ({
          code: violation.code,
          message: violation.message,
          field: violation.field,
        })),
      };
    }

    // `errorCode` existe desde NestJS 12 y es lo que deja que un servicio diga
    // COURSE_NOT_FOUND en vez del NOT_FOUND que sale del status. Sin él, cada
    // servicio que quería un código propio tenía que escribir su excepción:
    //
    //   throw new NotFoundException('Curso no encontrado', {
    //     errorCode: 'COURSE_NOT_FOUND',
    //   });
    //
    // Cuando no lo trae queda vacío, y el catálogo del estándar pone el suyo.
    return {
      status,
      kind: 'request',
      traceId,
      errors: [
        {
          code: exception.errorCode,
          message: this.messageOf(exception),
          field: null,
        },
      ],
    };
  }

  private messageOf(exception: HttpException): string {
    const body: unknown = exception.getResponse();

    if (typeof body === 'string') {
      return body;
    }

    if (typeof body === 'object' && body !== null) {
      const { message } = body as { message?: unknown };

      if (Array.isArray(message)) {
        return message.join(', ');
      }

      if (typeof message === 'string') {
        return message;
      }
    }

    return exception.message;
  }

  private log(
    exception: unknown,
    failure: ApiFailure,
    request: HttpRequestLike,
  ): void {
    // Los nombres de estos campos son un contrato con el índice de logs, no una
    // preferencia: `traceId` y `statusCode` son por los que están escritas las
    // consultas y los tableros que ya existen. Nombrarlos `requestId` y `status`
    // deja las líneas de error dentro del índice y fuera de toda búsqueda, que
    // es peor que no loguearlas -- se ven en un `docker logs` y no aparecen
    // cuando alguien investiga un incidente.
    //
    // `traceId` es además el mismo valor que pino-http publica como `req.id` en
    // la línea de la petición, así que una búsqueda por el UUID trae las dos.
    //
    // Los códigos salen del catálogo de Nova y no del estándar activo, a
    // propósito: la línea de log es de observabilidad, y cambiar la forma de la
    // respuesta no puede cambiar lo que buscan las consultas.
    //
    // Los campos propios de la excepción van primero, para que ninguno pise a
    // los de arriba: son el contrato con el índice y no se negocian.
    const detail = {
      ...logFieldsOf(exception),
      statusCode: failure.status,
      traceId: request.id,
      method: request.method,
      path: request.url,
      errors: failure.errors.map((error) =>
        errorItem(
          error.code ??
            errorCodeFor(NOVA_ERROR_CATALOG, failure.status, failure.kind),
          error.message,
          error.field,
        ),
      ),
    };

    const message = logMessageOf(exception);

    // A 4xx is the client being told it got something wrong, not a fault of
    // ours. Logging it at error level is what buries the 5xx that matter.
    //
    // Sólo el 5xx lleva el error con su stack: en un 4xx el stack apunta al
    // código que rechazó la petición, que funcionó bien.
    if (failure.status >= 500) {
      this.logger.error({ ...detail, err: exception }, message);
      return;
    }

    this.logger.warn(detail, message);
  }
}
