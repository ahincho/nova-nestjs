import { errorItem } from './api-error';

describe('errorItem', () => {
  it('defaults field to null so consumers never read undefined', () => {
    expect(errorItem('NOT_FOUND', 'Student not found')).toEqual({
      code: 'NOT_FOUND',
      message: 'Student not found',
      field: null,
    });
  });

  it('carries the offending field when given', () => {
    expect(
      errorItem('VALIDATION_ERROR', 'must be a number', 'periodId').field,
    ).toBe('periodId');
  });
});
