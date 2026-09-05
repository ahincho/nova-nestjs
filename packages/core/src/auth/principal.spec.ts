import { UnauthorizedException } from '@nestjs/common';
import { resolvePrincipal } from './principal';
import { resolveAuthOptions } from './tokens';

const options = resolveAuthOptions({ preferredRoles: ['student'] });

function claims(overrides: Record<string, unknown> = {}) {
  return {
    preferred_username: '@U12345',
    realm_access: { roles: ['student'] },
    ...overrides,
  };
}

describe('resolvePrincipal', () => {
  describe('the identifier', () => {
    it('comes from the configured claim, normalised', () => {
      expect(resolvePrincipal(claims(), options).id).toBe('U12345');
    });

    it('loses the leading at sign and the surrounding spaces', () => {
      const principal = resolvePrincipal(
        claims({ preferred_username: '  @u12345  ' }),
        options,
      );
      expect(principal.id).toBe('U12345');
    });

    // Un correo no es un código de usuario, pero si el emisor manda eso, la
    // arroba del medio se queda: recortarla inventaría un identificador.
    it('keeps an at sign that is not the first character', () => {
      const principal = resolvePrincipal(
        claims({ preferred_username: 'ana@utp.edu.pe' }),
        options,
      );
      expect(principal.id).toBe('ANA@UTP.EDU.PE');
    });

    it('can be normalised by the application', () => {
      const lowercase = resolveAuthOptions({
        normalizeId: (raw) => raw.toLowerCase(),
      });
      expect(resolvePrincipal(claims(), lowercase).id).toBe('@u12345');
    });

    it.each([
      ['the claim is missing', { preferred_username: undefined }],
      ['the claim is not a string', { preferred_username: 42 }],
      ['the claim is blank', { preferred_username: '   ' }],
      ['the claim is only an at sign', { preferred_username: '@' }],
    ])('is rejected when %s', (_case, overrides) => {
      expect(() => resolvePrincipal(claims(overrides), options)).toThrow(
        UnauthorizedException,
      );
    });
  });

  describe('the role', () => {
    it('is the preferred one wherever it appears in the list', () => {
      const principal = resolvePrincipal(
        claims({ realm_access: { roles: ['teacher', 'student'] } }),
        options,
      );
      expect(principal.role).toBe('student');
    });

    // Se devuelve el valor configurado y no el del token: la aplicación
    // compara contra una cadena estable.
    it('is spelled as configured, not as the issuer wrote it', () => {
      const principal = resolvePrincipal(
        claims({ realm_access: { roles: ['STUDENT'] } }),
        options,
      );
      expect(principal.role).toBe('student');
    });

    it('falls back to the first usable role', () => {
      const principal = resolvePrincipal(
        claims({ realm_access: { roles: ['coordinator', 'teacher'] } }),
        options,
      );
      expect(principal.role).toBe('coordinator');
    });

    // Estos describen lo que el token puede hacer, no quién lo trae.
    it('ignores the technical roles of the issuer', () => {
      const principal = resolvePrincipal(
        claims({
          realm_access: {
            roles: [
              'offline_access',
              'uma_authorization',
              'default-roles-nova',
              'teacher',
            ],
          },
        }),
        options,
      );
      expect(principal.role).toBe('teacher');
    });

    it('ignores a blank entry', () => {
      const principal = resolvePrincipal(
        claims({ realm_access: { roles: ['   ', 'teacher'] } }),
        options,
      );
      expect(principal.role).toBe('teacher');
    });

    it('ignores entries that are not strings', () => {
      const principal = resolvePrincipal(
        claims({ realm_access: { roles: [null, 7, 'teacher'] } }),
        options,
      );
      expect(principal.role).toBe('teacher');
    });

    it.each([
      ['the claim is missing', { realm_access: undefined }],
      ['the claim is not an array', { realm_access: { roles: 'student' } }],
      ['the list is empty', { realm_access: { roles: [] } }],
      [
        'every role is a technical one',
        { realm_access: { roles: ['offline_access', 'default-roles-nova'] } },
      ],
    ])('is rejected when %s', (_case, overrides) => {
      expect(() => resolvePrincipal(claims(overrides), options)).toThrow(
        UnauthorizedException,
      );
    });

    it('can live under another claim', () => {
      const custom = resolveAuthOptions({ rolesClaim: 'roles' });
      const principal = resolvePrincipal(
        { preferred_username: 'ana', roles: ['admin'] },
        custom,
      );
      expect(principal.role).toBe('admin');
    });
  });

  it('keeps the whole payload for whatever the application needs', () => {
    const principal = resolvePrincipal(claims({ campus: 'lima' }), options);
    expect(principal.claims['campus']).toBe('lima');
  });

  it('cannot be modified once resolved', () => {
    const principal = resolvePrincipal(claims(), options);
    expect(Object.isFrozen(principal)).toBe(true);
  });
});
