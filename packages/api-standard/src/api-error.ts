/**
 * A single error entry inside an {@link ApiResponse}.
 *
 * `field` names the offending input and is `null` for everything that is not a
 * validation error. It is never `undefined`: a consumer reading `error.field`
 * gets a value in both cases, so no optional-chaining is needed downstream.
 */
export type ApiErrorItem = {
  readonly code: string;
  readonly message: string;
  readonly field: string | null;
};

/**
 * Builds an {@link ApiErrorItem}, defaulting `field` to `null`.
 *
 * @example
 * errorItem('NOT_FOUND', 'Student not found');
 * errorItem('VALIDATION_ERROR', 'must be a number', 'periodId');
 */
export function errorItem(
  code: string,
  message: string,
  field: string | null = null,
): ApiErrorItem {
  return { code, message, field };
}
