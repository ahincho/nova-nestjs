/**
 * Code used for any 5xx, so a server fault never leaks which one it was.
 */
export const INTERNAL_ERROR_CODE = 'INTERNAL_SERVER_ERROR';

/**
 * Code used for a 4xx this table does not name.
 */
export const DEFAULT_ERROR_CODE = 'REQUEST_ERROR';

const STATUS_ERROR_CODES: Readonly<Record<number, string>> = {
  400: 'BAD_REQUEST',
  401: 'UNAUTHORIZED',
  403: 'FORBIDDEN',
  404: 'NOT_FOUND',
  405: 'METHOD_NOT_ALLOWED',
  406: 'NOT_ACCEPTABLE',
  408: 'REQUEST_TIMEOUT',
  409: 'CONFLICT',
  410: 'GONE',
  415: 'UNSUPPORTED_MEDIA_TYPE',
  422: 'UNPROCESSABLE_ENTITY',
  429: 'TOO_MANY_REQUESTS',
};

/**
 * Maps an HTTP status to the stable error code clients switch on.
 *
 * Clients branch on `code`, not on `status`, because the code survives a change
 * of transport. Every 5xx collapses to {@link INTERNAL_ERROR_CODE} on purpose:
 * telling a caller apart a 502 from a 504 tells them about our topology.
 */
export function statusToErrorCode(status: number): string {
  if (status >= 500) {
    return INTERNAL_ERROR_CODE;
  }
  return STATUS_ERROR_CODES[status] ?? DEFAULT_ERROR_CODE;
}
