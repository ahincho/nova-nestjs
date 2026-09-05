import {
  Injectable,
  type CallHandler,
  type ExecutionContext,
  type NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ApiResponses } from '../../api-standard';
import type { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { SKIP_RESPONSE_WRAPPER } from '../decorators/skip-response-wrapper.decorator';

type HttpResponseLike = {
  readonly statusCode?: number;
};

/**
 * Wraps whatever a handler returns in the standard envelope.
 *
 * Registered globally by `ApiStandardModule.forRoot()`, so a controller returns
 * its domain object and never builds the envelope itself.
 */
@Injectable()
export class ResponseWrapperInterceptor implements NestInterceptor {
  constructor(private readonly reflector: Reflector) {}

  intercept(
    context: ExecutionContext,
    next: CallHandler<unknown>,
  ): Observable<unknown> {
    // A microservice or websocket handler has no HTTP response to read a status
    // from, and its payload is not an HTTP body. Wrapping it would corrupt the
    // message.
    if (context.getType() !== 'http') {
      return next.handle();
    }

    const skip = this.reflector.getAllAndOverride<boolean | undefined>(
      SKIP_RESPONSE_WRAPPER,
      [context.getHandler(), context.getClass()],
    );

    if (skip === true) {
      return next.handle();
    }

    return next.handle().pipe(
      map((payload: unknown) => {
        // A handler that built its own envelope - typically to report a status
        // the framework cannot infer - is left alone rather than wrapped twice.
        if (ApiResponses.isApiResponse(payload)) {
          return payload;
        }

        const response = context.switchToHttp().getResponse<HttpResponseLike>();

        return ApiResponses.ok(payload, response.statusCode ?? 200);
      }),
    );
  }
}
