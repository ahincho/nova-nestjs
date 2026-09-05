import {
  VALIDATION_ERROR_CODE,
  validationExceptionFactory,
  type ValidationErrorLike,
} from './validation-exception.factory';
import { ValidationException } from './validation.exception';

describe('validationExceptionFactory', () => {
  it('reports one entry per constraint, each naming its field', () => {
    const errors: ValidationErrorLike[] = [
      { property: 'periodId', constraints: { isInt: 'must be an integer' } },
      {
        property: 'studentId',
        constraints: { isNotEmpty: 'must not be empty' },
      },
    ];

    const exception = validationExceptionFactory(errors);

    expect(exception).toBeInstanceOf(ValidationException);
    expect(exception.validationErrors).toEqual([
      {
        code: VALIDATION_ERROR_CODE,
        message: 'must be an integer',
        field: 'periodId',
      },
      {
        code: VALIDATION_ERROR_CODE,
        message: 'must not be empty',
        field: 'studentId',
      },
    ]);
  });

  it('reports every constraint of a single field', () => {
    const errors: ValidationErrorLike[] = [
      {
        property: 'email',
        constraints: {
          isEmail: 'must be an email',
          maxLength: 'must be shorter than 80 characters',
        },
      },
    ];

    expect(validationExceptionFactory(errors).validationErrors).toHaveLength(2);
  });

  // Without the dotted path the client is told "address is invalid" and has no
  // way to highlight the input that actually failed.
  it('flattens a nested DTO into a dotted path', () => {
    const errors: ValidationErrorLike[] = [
      {
        property: 'address',
        children: [
          {
            property: 'zipCode',
            constraints: { isPostalCode: 'invalid code' },
          },
        ],
      },
    ];

    expect(validationExceptionFactory(errors).validationErrors).toEqual([
      {
        code: VALIDATION_ERROR_CODE,
        message: 'invalid code',
        field: 'address.zipCode',
      },
    ]);
  });

  it('walks more than one level of nesting', () => {
    const errors: ValidationErrorLike[] = [
      {
        property: 'student',
        children: [
          {
            property: 'address',
            children: [
              {
                property: 'city',
                constraints: { isString: 'must be a string' },
              },
            ],
          },
        ],
      },
    ];

    expect(validationExceptionFactory(errors).validationErrors[0]?.field).toBe(
      'student.address.city',
    );
  });

  it('produces an empty list when nothing carries a constraint', () => {
    expect(validationExceptionFactory([]).validationErrors).toEqual([]);
  });
});
