import type { ApiErrorItem } from './api-error';

/**
 * The envelope every Nova HTTP endpoint answers with, on success and on failure.
 *
 * `data` and `errors` are mutually exclusive by construction: a success carries
 * an empty `errors`, a failure carries `data: null`. Nothing enforces that at
 * the type level, which is why nobody should build this object literally -
 * `ApiResponses` is the only place allowed to, and it keeps the invariant.
 *
 * @typeParam T - the payload type of a successful response.
 */
export type ApiResponse<T> = {
  readonly success: boolean;
  readonly status: number;
  readonly data: T | null;
  readonly errors: readonly ApiErrorItem[];
};
