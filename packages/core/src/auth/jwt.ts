/**
 * El cuerpo de un JWT ya decodificado. Sin forma propia a propósito: qué claims
 * trae depende del emisor.
 */
export type JwtClaims = Readonly<Record<string, unknown>>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * El token de una cabecera `Authorization`, o `undefined` si no hay un Bearer.
 */
export function bearerToken(authorization: unknown): string | undefined {
  if (typeof authorization !== 'string') {
    return undefined;
  }
  if (!authorization.toLowerCase().startsWith('bearer ')) {
    return undefined;
  }
  const token = authorization.slice(7).trim();
  return token === '' ? undefined : token;
}

/**
 * Lee los claims de un JWT **sin comprobar la firma**.
 *
 * Es lo que corresponde cuando alguien más ya la comprobó: un API Gateway o un
 * sidecar delante del servicio, que rechaza el token inválido antes de que la
 * petición llegue acá. En esa topología repetir la verificación cuesta una
 * llamada al emisor por petición y no agrega nada.
 *
 * En cualquier otra topología esto **no alcanza**, porque un token no
 * verificado lo puede escribir cualquiera. Para eso está la opción `verify`,
 * que reemplaza esta función por una comprobación de verdad.
 */
export function decodeJwtClaims(token: string): JwtClaims | undefined {
  const payload = token.split('.')[1];
  if (!payload) {
    return undefined;
  }

  try {
    const decoded: unknown = JSON.parse(
      Buffer.from(payload, 'base64url').toString('utf-8'),
    );
    return isRecord(decoded) ? decoded : undefined;
  } catch {
    // Un cuerpo que no es base64url, o que no es JSON, es un token que no se
    // puede leer; para el guard vale lo mismo que no haber mandado ninguno.
    return undefined;
  }
}

/**
 * Lee un claim por su ruta con puntos, por ejemplo `realm_access.roles`.
 */
export function readClaim(claims: JwtClaims, path: string): unknown {
  let current: unknown = claims;
  for (const segment of path.split('.')) {
    if (!isRecord(current)) {
      return undefined;
    }
    current = current[segment];
  }
  return current;
}
