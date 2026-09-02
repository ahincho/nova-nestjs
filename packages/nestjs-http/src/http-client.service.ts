import {
  BadGatewayException,
  GatewayTimeoutException,
  Inject,
  Injectable,
  Logger,
  Optional,
} from '@nestjs/common';
import {
  NOVA_HTTP_OPTIONS,
  OUTBOUND_HEADERS_PROVIDER,
  type OutboundHeadersProvider,
  type ResolvedNovaHttpOptions,
} from './tokens';
import { UpstreamHttpError } from './upstream-http.error';

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD';

export type QueryValue = string | number | boolean | undefined | null;

export type HttpRequestOptions = {
  /** Merged over the propagated and default headers. */
  readonly headers?: Record<string, string>;

  /** Appended as a query string. `undefined` and `null` entries are dropped. */
  readonly query?: Record<string, QueryValue>;

  /** Serialised as JSON. Omitted entirely when `undefined`. */
  readonly body?: unknown;

  /** Overrides the module-wide timeout for this call. */
  readonly timeoutMs?: number;

  /**
   * Raises {@link UpstreamHttpError} with the upstream status and body instead
   * of translating the failure to a 502 or a 504. Use it when the caller has to
   * map the upstream's own semantics - a 404 that should stay a 404, say.
   */
  readonly forwardError?: boolean;
};

/**
 * The outbound HTTP client every Nova service calls its upstreams through.
 *
 * Built on the global `fetch`, so the package ships no HTTP dependency of its
 * own. What it adds over a bare `fetch` is the part that was being rewritten in
 * every service: a timeout that is always set, correlation headers that travel
 * on their own, an upstream failure that cannot reach the client verbatim, and
 * a log line that never carries the response body.
 */
@Injectable()
export class HttpClientService {
  private readonly logger = new Logger(HttpClientService.name);

  constructor(
    @Inject(NOVA_HTTP_OPTIONS)
    private readonly options: ResolvedNovaHttpOptions,
    @Optional()
    @Inject(OUTBOUND_HEADERS_PROVIDER)
    private readonly headersProvider?: OutboundHeadersProvider,
  ) {}

  get<T>(url: string, options?: HttpRequestOptions): Promise<T> {
    return this.request<T>('GET', url, options);
  }

  post<T>(
    url: string,
    body: unknown,
    options?: HttpRequestOptions,
  ): Promise<T> {
    return this.request<T>('POST', url, { ...options, body });
  }

  put<T>(url: string, body: unknown, options?: HttpRequestOptions): Promise<T> {
    return this.request<T>('PUT', url, { ...options, body });
  }

  patch<T>(
    url: string,
    body: unknown,
    options?: HttpRequestOptions,
  ): Promise<T> {
    return this.request<T>('PATCH', url, { ...options, body });
  }

  delete<T>(url: string, options?: HttpRequestOptions): Promise<T> {
    return this.request<T>('DELETE', url, options);
  }

  async request<T>(
    method: HttpMethod,
    url: string,
    options: HttpRequestOptions = {},
  ): Promise<T> {
    const target = this.withQuery(url, options.query);
    const timeoutMs = options.timeoutMs ?? this.options.defaultTimeoutMs;

    const response = await this.send(method, target, options, timeoutMs);
    const text = await response.text();

    if (response.status >= 400) {
      return this.fail(method, target, response, text, options);
    }

    return this.parse<T>(text);
  }

  private async send(
    method: HttpMethod,
    target: string,
    options: HttpRequestOptions,
    timeoutMs: number,
  ): Promise<Response> {
    try {
      return await fetch(target, {
        method,
        headers: {
          'content-type': 'application/json',
          ...this.options.defaultHeaders,
          ...this.propagatedHeaders(),
          ...options.headers,
        },
        body:
          options.body === undefined ? undefined : JSON.stringify(options.body),
        // AbortSignal.timeout is what guarantees the call cannot outlive the
        // timeout even if the upstream keeps the socket open while sending
        // nothing, which a header-only deadline does not cover.
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (cause) {
      const safeTarget = this.safeUrl(target);

      if (cause instanceof Error && cause.name === 'TimeoutError') {
        this.logger.error(
          `${method} ${safeTarget} timed out after ${timeoutMs}ms`,
        );
        throw new GatewayTimeoutException('Upstream service timed out');
      }

      this.logger.error(
        `${method} ${safeTarget} could not be reached`,
        cause instanceof Error ? cause.stack : undefined,
      );
      throw new BadGatewayException('Upstream service error');
    }
  }

  private fail<T>(
    method: HttpMethod,
    target: string,
    response: Response,
    text: string,
    options: HttpRequestOptions,
  ): T {
    // The body is deliberately absent from the log: an upstream error payload
    // routinely echoes back the identifiers of the person the request was
    // about.
    this.logger.error(
      `${method} ${this.safeUrl(target)} responded ${response.status}`,
    );

    if (options.forwardError) {
      throw new UpstreamHttpError(
        response.status,
        this.parse<unknown>(text),
        Object.fromEntries(response.headers),
      );
    }

    if (response.status === 504 || response.status === 408) {
      throw new GatewayTimeoutException('Upstream service timed out');
    }

    throw new BadGatewayException('Upstream service error');
  }

  private propagatedHeaders(): Record<string, string> {
    try {
      return this.headersProvider?.headers() ?? {};
    } catch (cause) {
      // Losing the correlation id degrades a trace. Failing the call because
      // the context could not be read would turn that into an outage.
      this.logger.warn(
        `Could not build the propagated headers: ${String(cause)}`,
      );
      return {};
    }
  }

  private withQuery(url: string, query?: Record<string, QueryValue>): string {
    if (!query) {
      return url;
    }

    const params = new URLSearchParams();

    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined && value !== null) {
        params.append(key, String(value));
      }
    }

    const serialised = params.toString();

    if (serialised === '') {
      return url;
    }

    return url.includes('?') ? `${url}&${serialised}` : `${url}?${serialised}`;
  }

  private parse<T>(text: string): T {
    if (text === '') {
      return undefined as T;
    }

    try {
      return JSON.parse(text) as T;
    } catch {
      // A gateway answering HTML where JSON was expected is the usual case,
      // and the text itself is more useful than a parse error.
      return text as T;
    }
  }

  /**
   * Strips the query string and any credentials before a URL reaches a log.
   *
   * A query string carries identifiers of the person the request was about, and
   * those must not end up in a log index that more people can read than can
   * read the database.
   */
  private safeUrl(url: string): string {
    try {
      const parsed = new URL(url);
      parsed.search = '';
      parsed.username = '';
      parsed.password = '';
      return parsed.toString();
    } catch {
      return url.split('?')[0] ?? url;
    }
  }
}
