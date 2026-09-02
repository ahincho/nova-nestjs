import {
  DEFAULT_API_STANDARD_OPTIONS,
  resolveApiStandardOptions,
} from './tokens';

describe('resolveApiStandardOptions', () => {
  it('applies every default when called with nothing', () => {
    expect(resolveApiStandardOptions()).toEqual(DEFAULT_API_STANDARD_OPTIONS);
  });

  it('honours an explicit false', () => {
    const options = resolveApiStandardOptions({ wrapResponses: false });

    expect(options.wrapResponses).toBe(false);
    expect(options.catchExceptions).toBe(true);
  });

  // The reason this is not a spread: `{ ...defaults, ...{ a: undefined } }`
  // overwrites the default with undefined, which every call site then reads
  // as "disabled".
  it('keeps the default when a field is explicitly undefined', () => {
    const options = resolveApiStandardOptions({ catchExceptions: undefined });

    expect(options.catchExceptions).toBe(true);
  });

  it('overrides the internal error message', () => {
    const options = resolveApiStandardOptions({
      internalErrorMessage: 'Error interno del servidor',
    });

    expect(options.internalErrorMessage).toBe('Error interno del servidor');
  });
});
