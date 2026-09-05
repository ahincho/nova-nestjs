import { bearerToken, decodeJwtClaims, readClaim } from './jwt';

function token(claims: unknown): string {
  const payload = Buffer.from(JSON.stringify(claims)).toString('base64url');
  return `header.${payload}.signature`;
}

describe('bearerToken', () => {
  it('takes the token out of the header', () => {
    expect(bearerToken('Bearer abc.def.ghi')).toBe('abc.def.ghi');
  });

  // El esquema es insensible a mayúsculas por RFC 7235, y hay clientes que
  // mandan `bearer`.
  it('accepts the scheme in any case', () => {
    expect(bearerToken('bearer abc')).toBe('abc');
    expect(bearerToken('BEARER abc')).toBe('abc');
  });

  it.each([
    ['nothing at all', undefined],
    ['a header that is not a string', 42],
    ['another scheme', 'Basic dXNlcjpwYXNz'],
    ['a scheme with no token', 'Bearer '],
  ])('has no token for %s', (_case, header) => {
    expect(bearerToken(header)).toBeUndefined();
  });
});

describe('decodeJwtClaims', () => {
  it('reads the payload', () => {
    expect(decodeJwtClaims(token({ sub: '1', role: 'a' }))).toEqual({
      sub: '1',
      role: 'a',
    });
  });

  it.each([
    ['a token with no payload segment', 'onlyheader'],
    ['a payload that is not base64url json', 'header.###.signature'],
    ['a payload that decodes to an array', token([1, 2])],
    ['a payload that decodes to a string', token('hello')],
  ])('reads nothing from %s', (_case, value) => {
    expect(decodeJwtClaims(value)).toBeUndefined();
  });

  // La firma no se mira: es trabajo del gateway que está delante.
  it('does not care what the signature says', () => {
    const [header, payload] = token({ sub: '1' }).split('.');
    expect(decodeJwtClaims(`${header}.${payload}.tampered`)).toEqual({
      sub: '1',
    });
  });
});

describe('readClaim', () => {
  const claims = {
    preferred_username: '@U12345',
    realm_access: { roles: ['student'] },
  };

  it('reads a claim at the top level', () => {
    expect(readClaim(claims, 'preferred_username')).toBe('@U12345');
  });

  it('walks a dotted path', () => {
    expect(readClaim(claims, 'realm_access.roles')).toEqual(['student']);
  });

  it.each([
    ['a path that does not exist', 'resource_access.roles'],
    ['a path that goes through a non object', 'preferred_username.length'],
  ])('reads nothing for %s', (_case, path) => {
    expect(readClaim(claims, path)).toBeUndefined();
  });
});
