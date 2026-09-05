import { BadRequestException } from '@nestjs/common';
import type { ApiErrorItem } from '../../api-standard';

/**
 * A 400 carrying one entry per failed constraint, each naming its field.
 *
 * A plain `BadRequestException` collapses every constraint into a single
 * string, so a form cannot tell which input to highlight.
 */
export class ValidationException extends BadRequestException {
  constructor(readonly validationErrors: readonly ApiErrorItem[]) {
    super('Validation failed');
  }
}
