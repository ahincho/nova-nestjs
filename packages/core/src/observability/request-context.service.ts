import { Injectable } from '@nestjs/common';
import { AsyncLocalStorage } from 'node:async_hooks';
import type { RequestContext } from './request-context';

/**
 * Reads and carries the {@link RequestContext} of the request in flight.
 *
 * Also the implementation behind `OUTBOUND_HEADERS_PROVIDER` of
 * `@ahincho/nova-nestjs-http`: it satisfies that port structurally, so the
 * aggregator can bind the two without either package importing the other.
 */
@Injectable()
export class RequestContextService {
  private readonly storage = new AsyncLocalStorage<RequestContext>();

  /**
   * Runs `callback` with `context` visible to everything it awaits.
   */
  run<T>(context: RequestContext, callback: () => T): T {
    return this.storage.run(context, callback);
  }

  /**
   * The current context, or `undefined` outside a request - a scheduled job or
   * a consumer, where there is no incoming call to correlate with.
   */
  get(): RequestContext | undefined {
    return this.storage.getStore();
  }

  /**
   * The id of the request in flight, if there is one.
   */
  requestId(): string | undefined {
    return this.storage.getStore()?.requestId;
  }

  /**
   * The headers every outbound call should carry.
   *
   * Empty outside a request, so a background job calls upstreams without
   * inventing a correlation that does not exist.
   */
  headers(): Record<string, string> {
    return { ...(this.storage.getStore()?.headers ?? {}) };
  }
}
