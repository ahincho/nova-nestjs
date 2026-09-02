import { errorItem, type ApiErrorItem } from '@nova-platform/api-standard';
import { ValidationException } from './validation.exception';

export const VALIDATION_ERROR_CODE = 'VALIDATION_ERROR';

/**
 * The shape of a `class-validator` `ValidationError`, declared structurally.
 *
 * Declaring it here rather than importing the class is what keeps this package
 * free of a runtime dependency on `class-validator`: an application using a
 * different validator can hand over the same shape and get the same envelope.
 */
export type ValidationErrorLike = {
  readonly property: string;
  readonly constraints?: Record<string, string>;
  readonly children?: readonly ValidationErrorLike[];
};

function toErrorItems(
  errors: readonly ValidationErrorLike[],
  parentPath = '',
): ApiErrorItem[] {
  const items: ApiErrorItem[] = [];

  for (const error of errors) {
    const path = parentPath
      ? parentPath + '.' + error.property
      : error.property;

    for (const message of Object.values(error.constraints ?? {})) {
      items.push(errorItem(VALIDATION_ERROR_CODE, message, path));
    }

    // A nested DTO reports its own failures under `children`. Flattening them
    // with a dotted path is what lets the client point at `address.zipCode`
    // instead of at `address`.
    if (error.children && error.children.length > 0) {
      items.push(...toErrorItems(error.children, path));
    }
  }

  return items;
}

/**
 * Turns validation errors into a {@link ValidationException}.
 *
 * Wire it into the global pipe as the `exceptionFactory`, so a failed DTO comes
 * back as the standard envelope with one entry per constraint.
 */
export function validationExceptionFactory(
  errors: readonly ValidationErrorLike[],
): ValidationException {
  return new ValidationException(toErrorItems(errors));
}
