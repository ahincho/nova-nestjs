/**
 * DI token holding the resolved {@link NovaHttpModuleOptions}.
 */
export const NOVA_HTTP_OPTIONS = Symbol('NOVA_HTTP_OPTIONS');

/**
 * DI token for the optional {@link OutboundHeadersProvider}.
 */
export const OUTBOUND_HEADERS_PROVIDER = Symbol(
  'NOVA_OUTBOUND_HEADERS_PROVIDER',
);

/**
 * Supplies the headers every outbound call should carry.
 *
 * This is the seam that lets a correlation id travel from the incoming request
 * to the upstream without any call site passing it. It is an injected port
 * rather than a direct dependency so this package stays independent of how the
 * context is kept - `@ahincho/nova-nestjs-observability` provides one backed
 * by `AsyncLocalStorage`, and an application can provide its own.
 */
export interface OutboundHeadersProvider {
  headers(): Record<string, string>;
}

export type NovaHttpModuleOptions = {
  /**
   * How long a call may take before it is aborted, when the call site does not
   * say. Defaults to 5000.
   */
  readonly defaultTimeoutMs?: number;

  /**
   * Headers added to every outbound call, below the propagated ones and below
   * the ones the call site passes.
   */
  readonly defaultHeaders?: Record<string, string>;
};

export type ResolvedNovaHttpOptions = {
  readonly defaultTimeoutMs: number;
  readonly defaultHeaders: Record<string, string>;
};

export const DEFAULT_HTTP_TIMEOUT_MS = 5000;

/**
 * Applies defaults field by field, so an explicitly passed `undefined` cannot
 * overwrite a default with `undefined`.
 */
export function resolveNovaHttpOptions(
  options: NovaHttpModuleOptions = {},
): ResolvedNovaHttpOptions {
  return {
    defaultTimeoutMs: options.defaultTimeoutMs ?? DEFAULT_HTTP_TIMEOUT_MS,
    defaultHeaders: options.defaultHeaders ?? {},
  };
}
