import {
  DEFAULT_ERROR_CODE,
  INTERNAL_ERROR_CODE,
  statusToErrorCode,
} from './error-code';

describe('statusToErrorCode', () => {
  it.each([
    [400, 'BAD_REQUEST'],
    [401, 'UNAUTHORIZED'],
    [403, 'FORBIDDEN'],
    [404, 'NOT_FOUND'],
    [409, 'CONFLICT'],
    [422, 'UNPROCESSABLE_ENTITY'],
    [429, 'TOO_MANY_REQUESTS'],
  ])('maps %i to %s', (status, expected) => {
    expect(statusToErrorCode(status)).toBe(expected);
  });

  it('falls back to the generic code for an unnamed 4xx', () => {
    expect(statusToErrorCode(418)).toBe(DEFAULT_ERROR_CODE);
  });

  // A 502 and a 504 describe our topology to someone who should not learn it
  // from an error body, so both collapse to the same code.
  it.each([500, 502, 503, 504, 599])(
    'collapses %i to the internal code',
    (status) => {
      expect(statusToErrorCode(status)).toBe(INTERNAL_ERROR_CODE);
    },
  );
});
