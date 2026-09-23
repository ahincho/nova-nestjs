import type { ApiFailureKind } from './api-standard';

/**
 * Code used for any 5xx, so a server fault never leaks which one it was.
 */
export const INTERNAL_ERROR_CODE = 'INTERNAL_SERVER_ERROR';

/**
 * Code used for a 4xx this table does not name.
 */
export const DEFAULT_ERROR_CODE = 'REQUEST_ERROR';

/**
 * Código de un fallo de validación de la entrada, con una entrada por campo.
 */
export const VALIDATION_ERROR_CODE = 'VALIDATION_ERROR';

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
 * Qué código lleva cada fallo que no trae uno propio.
 *
 * Es del estándar y no del núcleo: cómo se **nombra** un fallo es forma, y una
 * organización puede tener la suya. Qué se le **dice** al cliente en un 5xx, en
 * cambio, es contenido, y eso lo decide el núcleo antes de que el catálogo
 * intervenga.
 */
export type ApiErrorCatalog = {
  /** Un fallo de validación de la entrada. */
  readonly validation: string;

  /**
   * Por status HTTP. Lo que no esté acá cae en {@link ApiErrorCatalog.request}
   * o en {@link ApiErrorCatalog.internal}.
   */
  readonly byStatus: Readonly<Record<number, string>>;

  /** Un 4xx que `byStatus` no nombra. */
  readonly request: string;

  /** Un 5xx que `byStatus` no nombra. */
  readonly internal: string;
};

/**
 * El catálogo de Nova.
 *
 * No nombra ningún 5xx, así que todos colapsan a {@link INTERNAL_ERROR_CODE}.
 * Es una convención y no una regla: el status ya viaja en la línea de estado,
 * así que llamarlo `BAD_GATEWAY` no le cuenta al cliente nada que no sepa, y un
 * catálogo propio puede hacerlo.
 */
export const NOVA_ERROR_CATALOG: ApiErrorCatalog = {
  validation: VALIDATION_ERROR_CODE,
  byStatus: STATUS_ERROR_CODES,
  request: DEFAULT_ERROR_CODE,
  internal: INTERNAL_ERROR_CODE,
};

/**
 * El código que un catálogo le da a un fallo.
 */
export function errorCodeFor(
  catalog: ApiErrorCatalog,
  status: number,
  kind: ApiFailureKind,
): string {
  if (kind === 'validation') {
    return catalog.validation;
  }
  return (
    catalog.byStatus[status] ??
    (status >= 500 ? catalog.internal : catalog.request)
  );
}

/**
 * Maps an HTTP status to the stable error code clients switch on, using
 * {@link NOVA_ERROR_CATALOG}.
 *
 * Clients branch on `code`, not on `status`, because the code survives a change
 * of transport. Every 5xx collapses to {@link INTERNAL_ERROR_CODE} in this
 * catalog: telling a caller apart a 502 from a 504 tells them about our
 * topology.
 */
export function statusToErrorCode(status: number): string {
  return errorCodeFor(
    NOVA_ERROR_CATALOG,
    status,
    status >= 500 ? 'internal' : 'request',
  );
}
