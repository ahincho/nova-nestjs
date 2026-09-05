import {
  EnvironmentError,
  booleanEnv,
  numberEnv,
  optionalEnv,
  requireEnv,
  urlEnv,
} from './environment';

const VARIABLE = 'NOVA_TEST_VARIABLE';

describe('environment readers', () => {
  afterEach(() => {
    delete process.env[VARIABLE];
  });

  describe('requireEnv', () => {
    it('returns the value, trimmed', () => {
      process.env[VARIABLE] = '  value  ';

      expect(requireEnv(VARIABLE)).toBe('value');
    });

    it('names the variable when it is missing', () => {
      expect(() => requireEnv(VARIABLE)).toThrow(EnvironmentError);
      expect(() => requireEnv(VARIABLE)).toThrow(
        `Environment variable ${VARIABLE} is required but was not set`,
      );
    });

    // A task definition with the value left blank produces an empty string, and
    // treating it as present is what turns a configuration mistake into a
    // failure somewhere else entirely.
    it('treats a blank value as missing', () => {
      process.env[VARIABLE] = '   ';

      expect(() => requireEnv(VARIABLE)).toThrow(EnvironmentError);
    });
  });

  describe('optionalEnv', () => {
    it('falls back when missing or blank', () => {
      expect(optionalEnv(VARIABLE, 'fallback')).toBe('fallback');

      process.env[VARIABLE] = '';
      expect(optionalEnv(VARIABLE, 'fallback')).toBe('fallback');
    });

    it('prefers the configured value', () => {
      process.env[VARIABLE] = 'configured';

      expect(optionalEnv(VARIABLE, 'fallback')).toBe('configured');
    });
  });

  describe('numberEnv', () => {
    it('parses a number', () => {
      process.env[VARIABLE] = '3000';

      expect(numberEnv(VARIABLE)).toBe(3000);
    });

    it('falls back when missing', () => {
      expect(numberEnv(VARIABLE, 5000)).toBe(5000);
    });

    it('requires the variable when there is no fallback', () => {
      expect(() => numberEnv(VARIABLE)).toThrow(EnvironmentError);
    });

    // `Number('8080abc')` is NaN and `Number('')` is 0. Reporting the text is
    // what stops a typo from becoming a zero timeout nobody can explain.
    it('reports the offending text', () => {
      process.env[VARIABLE] = '8080abc';

      expect(() => numberEnv(VARIABLE)).toThrow('must be a number');
      expect(() => numberEnv(VARIABLE)).toThrow('8080abc');
    });
  });

  describe('booleanEnv', () => {
    it.each([
      ['true', true],
      ['TRUE', true],
      ['1', true],
      ['yes', true],
      ['false', false],
      ['0', false],
      ['no', false],
    ])('reads %s as %s', (raw, expected) => {
      process.env[VARIABLE] = raw;

      expect(booleanEnv(VARIABLE)).toBe(expected);
    });

    it('falls back when missing', () => {
      expect(booleanEnv(VARIABLE, false)).toBe(false);
    });

    it('rejects a value that is neither', () => {
      process.env[VARIABLE] = 'maybe';

      expect(() => booleanEnv(VARIABLE)).toThrow('must be a boolean');
    });
  });

  describe('urlEnv', () => {
    it('returns an absolute URL untouched', () => {
      process.env[VARIABLE] = 'http://academic.internal:8080';

      expect(urlEnv(VARIABLE)).toBe('http://academic.internal:8080');
    });

    // `${base}/path` with a trailing slash becomes a double slash, which some
    // gateways route to a different rule than the one that was tested.
    it('strips trailing slashes', () => {
      process.env[VARIABLE] = 'https://api.example.com/nova//';

      expect(urlEnv(VARIABLE)).toBe('https://api.example.com/nova');
    });

    // `academic.internal:8080` does parse as a URL, with `academic.internal:`
    // as its protocol, so the missing scheme has to be caught by the protocol
    // check rather than by the parse.
    it.each([
      'academic.internal:8080',
      'ftp://files.example.com',
      'not a url at all',
    ])('rejects %s', (raw) => {
      process.env[VARIABLE] = raw;

      expect(() => urlEnv(VARIABLE)).toThrow('must be an absolute http(s) URL');
    });

    it('reports a missing URL like any other required variable', () => {
      expect(() => urlEnv(VARIABLE)).toThrow('is required but was not set');
    });
  });
});
