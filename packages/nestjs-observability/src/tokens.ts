import { DEFAULT_CORRELATION_HEADERS } from './request-context';

export const OBSERVABILITY_OPTIONS = Symbol('NOVA_OBSERVABILITY_OPTIONS');

export type NovaObservabilityModuleOptions = {
  /**
   * Headers carried from the incoming request onto every outbound one. The
   * first is the correlation id and is generated when the caller omits it.
   */
  readonly correlationHeaders?: readonly string[];

  /**
   * Produces a correlation id when the caller did not send one. Defaults to
   * `crypto.randomUUID`.
   */
  readonly generateId?: () => string;

  /**
   * Echoes the correlation id back on the response. Defaults to true - the
   * caller needs it to report a failure, and a browser can only read it because
   * the CORS policy exposes that header.
   */
  readonly echoRequestId?: boolean;
};

export type ResolvedObservabilityOptions = {
  readonly correlationHeaders: readonly string[];
  readonly generateId: () => string;
  readonly echoRequestId: boolean;
};

export function resolveObservabilityOptions(
  options: NovaObservabilityModuleOptions = {},
): ResolvedObservabilityOptions {
  return {
    correlationHeaders:
      options.correlationHeaders ?? DEFAULT_CORRELATION_HEADERS,
    generateId: options.generateId ?? (() => crypto.randomUUID()),
    echoRequestId: options.echoRequestId ?? true,
  };
}
