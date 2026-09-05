import { UnauthorizedException } from '@nestjs/common';
import { readClaim, type JwtClaims } from './jwt';
import type { ResolvedAuthOptions } from './tokens';

/**
 * Quién hace la petición, según el token que la trae.
 *
 * `claims` queda entero para lo que la aplicación necesite y la plataforma no
 * conoce: un `email`, un `campus`, lo que el emisor ponga.
 */
export type Principal = {
  readonly id: string;
  readonly role: string;
  readonly claims: JwtClaims;
};

function resolveId(claims: JwtClaims, options: ResolvedAuthOptions): string {
  const raw = readClaim(claims, options.idClaim);
  if (typeof raw !== 'string') {
    throw new UnauthorizedException();
  }

  const id = options.normalizeId(raw);
  if (id === '') {
    throw new UnauthorizedException();
  }

  return id;
}

function usable(role: string, options: ResolvedAuthOptions): boolean {
  if (role === '') {
    return false;
  }
  const normalized = role.toLowerCase();
  const ignored = options.ignoredRoles.some(
    (candidate) => candidate.toLowerCase() === normalized,
  );
  if (ignored) {
    return false;
  }
  return !options.ignoredRolePrefixes.some((prefix) =>
    normalized.startsWith(prefix.toLowerCase()),
  );
}

function resolveRole(claims: JwtClaims, options: ResolvedAuthOptions): string {
  const raw = readClaim(claims, options.rolesClaim);
  if (!Array.isArray(raw)) {
    throw new UnauthorizedException();
  }

  const roles = raw
    .filter((role): role is string => typeof role === 'string')
    .map((role) => role.trim())
    .filter((role) => usable(role, options));

  // El rol preferido gana venga en la posición que venga, y se devuelve tal
  // como está configurado: la aplicación compara contra una cadena estable y no
  // contra la que el emisor haya escrito esta vez.
  const preferred = options.preferredRoles.find((candidate) =>
    roles.some((role) => role.toLowerCase() === candidate.toLowerCase()),
  );
  if (preferred !== undefined) {
    return preferred;
  }

  const [first] = roles;
  if (first === undefined) {
    throw new UnauthorizedException();
  }

  return first;
}

/**
 * Arma el {@link Principal} a partir de los claims, o lanza `Unauthorized`.
 *
 * Un token sin identificador o sin un rol utilizable es un token que no
 * describe a nadie. Dejarlo pasar es peor que rechazarlo, porque el servicio
 * termina autorizando contra un `undefined`.
 */
export function resolvePrincipal(
  claims: JwtClaims,
  options: ResolvedAuthOptions,
): Principal {
  return Object.freeze({
    id: resolveId(claims, options),
    role: resolveRole(claims, options),
    claims,
  });
}
