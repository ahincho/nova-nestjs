/**
 * What is known about the request currently being served.
 *
 * Held in an `AsyncLocalStorage`, so anything running underneath a request can
 * read it without the value being threaded through every signature - which is
 * what made every service grow its own way of passing a correlation id down.
 */
export type RequestContext = {
  /**
   * Always present: taken from the incoming header, or generated when the
   * caller did not send one.
   */
  readonly requestId: string;

  /**
   * The headers to put on every outbound call, including the request id.
   */
  readonly headers: Readonly<Record<string, string>>;
};

/**
 * Headers copied from the incoming request onto every outbound one.
 *
 * The first is the correlation id and is generated when absent; the rest travel
 * only if the caller sent them.
 */
export const DEFAULT_CORRELATION_HEADERS = [
  'x-request-id',
  'x-user-id',
  'x-tenant-id',
] as const;

export type IncomingHeaders = Readonly<
  Record<string, string | string[] | undefined>
>;

function firstValue(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) {
    return value[0];
  }
  return value;
}

/**
 * Builds the context for one request.
 *
 * @param headers - the incoming headers, read case-insensitively.
 * @param correlationHeaders - which headers to carry, the first being the id.
 * @param generateId - produces an id when the caller did not send one.
 */
export function buildRequestContext(
  headers: IncomingHeaders,
  correlationHeaders: readonly string[],
  generateId: () => string,
): RequestContext {
  const lowercased: Record<string, string | string[] | undefined> = {};
  for (const [name, value] of Object.entries(headers)) {
    lowercased[name.toLowerCase()] = value;
  }

  const [idHeader = 'x-request-id', ...rest] = correlationHeaders;
  const requestId = firstValue(lowercased[idHeader]) ?? generateId();

  const propagated: Record<string, string> = { [idHeader]: requestId };

  for (const name of rest) {
    const value = firstValue(lowercased[name]);
    // Absent headers are left out rather than sent empty: an empty `x-user-id`
    // downstream reads as "there is a user and it has no id", which is worse
    // than saying nothing.
    if (value !== undefined && value !== '') {
      propagated[name] = value;
    }
  }

  return { requestId, headers: propagated };
}
