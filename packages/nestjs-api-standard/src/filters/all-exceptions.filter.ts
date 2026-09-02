import {
  Catch,
  HttpException,
  HttpStatus,
  Inject,
  Logger,
  type ArgumentsHost,
  type ExceptionFilter,
} from '@nestjs/common';
import {
  ApiResponses,
  INTERNAL_ERROR_CODE,
  errorItem,
  statusToErrorCode,
  type ApiErrorItem,
} from '@ahincho/nova-api-standard';
import { ValidationException } from '../exceptions/validation.exception';
import {
  API_STANDARD_OPTIONS,
  type ResolvedApiStandardOptions,
} from '../tokens';

/**
 * The slice of the platform response object this filter uses.
 *
 * Typed structurally so the package does not depend on `@types/express`: the
 * same filter works under Fastify.
 */
type HttpResponseLike = {
  status(code: number): { json(body: unknown): unknown };
};

type HttpRequestLike = {
  readonly id?: string;
  readonly url?: string;
  readonly method?: string;
};

/**
 * Catches every unhandled exception and answers with the standard envelope.
 *
 * Logs through Nest's own `Logger`, so an application that installed a logger
 * with `app.useLogger()` gets these entries in its own format without this
 * package depending on any logging library.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  constructor(
    @Inject(API_STANDARD_OPTIONS)
    private readonly options: ResolvedApiStandardOptions,
  ) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    if (host.getType() !== 'http') {
      // Nothing to answer on. Reported rather than swallowed, because a
      // silent drop here looks like the handler simply never ran.
      this.logger.error(
        'Unhandled exception outside an HTTP context',
        exception instanceof Error ? exception.stack : undefined,
      );
      return;
    }

    const context = host.switchToHttp();
    const request = context.getRequest<HttpRequestLike>();
    const status = this.statusOf(exception);
    const errors = this.errorsOf(exception, status);

    this.log(exception, status, errors, request);

    context
      .getResponse<HttpResponseLike>()
      .status(status)
      .json(ApiResponses.error(status, ...errors));
  }

  private statusOf(exception: unknown): number {
    return exception instanceof HttpException
      ? exception.getStatus()
      : HttpStatus.INTERNAL_SERVER_ERROR;
  }

  private errorsOf(exception: unknown, status: number): ApiErrorItem[] {
    // Anything that is not an HttpException arrives here as a 500, so folding
    // the two conditions is what makes the rest of this method total: below
    // this line the exception is always an HttpException under 500.
    if (status >= 500 || !(exception instanceof HttpException)) {
      return [
        errorItem(INTERNAL_ERROR_CODE, this.options.internalErrorMessage),
      ];
    }

    if (exception instanceof ValidationException) {
      return [...exception.validationErrors];
    }

    return [errorItem(statusToErrorCode(status), this.messageOf(exception))];
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
    status: number,
    errors: readonly ApiErrorItem[],
    request: HttpRequestLike,
  ): void {
    const detail = {
      status,
      requestId: request.id,
      method: request.method,
      path: request.url,
      errors,
    };

    // A 4xx is the client being told it got something wrong, not a fault of
    // ours. Logging it at error level is what buries the 5xx that matter.
    if (status >= 500) {
      this.logger.error(
        detail,
        exception instanceof Error ? exception.stack : undefined,
      );
      return;
    }

    this.logger.warn(detail);
  }
}
