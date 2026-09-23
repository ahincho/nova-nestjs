/**
 * Prefijo por el que se descubren las variables que traen un secreto entero.
 *
 * Es una convención, no una lista: la plataforma no puede saber cómo se llaman
 * los secretos de un servicio que todavía no existe, y enumerarlos acá haría
 * que agregar uno nuevo exija publicar una versión.
 */
export const DEFAULT_SECRET_PREFIX = 'SECRET_';

/**
 * Variable que nombra, separadas por coma, las variables a desdoblar.
 *
 * Es la salida de emergencia para el secreto que no sigue la convención: quien
 * opera el servicio la agrega a la task definition y el desdoblado la toma, sin
 * tocar el código ni desplegar una versión nueva. Existe porque en esta
 * topología el ambiente lo gobierna operaciones y el código lo gobierna el
 * equipo, y un nombre nuevo no debería necesitar a los dos.
 */
export const SECRET_VARIABLES_VARIABLE = 'NOVA_SECRETS';

export type UnfoldSecretsOptions = {
  /**
   * Variables a desdoblar, nombradas una por una. Se suman a las que descubre
   * el prefijo; no las reemplazan.
   */
  readonly variables?: readonly string[];

  /**
   * Prefijo por el que se descubren. Por defecto {@link DEFAULT_SECRET_PREFIX}.
   * En `false` no se descubre nada y sólo valen las nombradas.
   */
  readonly prefix?: string | false;

  /**
   * Si una clave del secreto pisa una variable suelta que ya existe. Por
   * defecto `true`: es la convención de la casa, y equivale al ordinal 350 que
   * el `ConfigSource` del lado Quarkus le da a la misma fuente.
   */
  readonly override?: boolean;

  /** De dónde se lee y dónde se escribe. Por defecto `process.env`. */
  readonly env?: NodeJS.ProcessEnv;
};

/**
 * Falla del desdoblado. Nombra la variable y **nunca su contenido**: el valor
 * de un secreto no llega a un log ni siquiera dentro de un `catch`.
 */
export class SecretUnfoldError extends Error {
  constructor(
    readonly variable: string,
    reason: string,
  ) {
    super(`Secret variable ${variable} ${reason}`);
    this.name = 'SecretUnfoldError';
  }
}

function namedVariables(env: NodeJS.ProcessEnv): string[] {
  const raw = env[SECRET_VARIABLES_VARIABLE];
  if (raw === undefined) {
    return [];
  }
  return raw
    .split(',')
    .map((name) => name.trim())
    .filter((name) => name !== '');
}

function discovered(env: NodeJS.ProcessEnv, prefix: string | false): string[] {
  if (prefix === false || prefix === '') {
    return [];
  }
  return Object.keys(env).filter((name) => name.startsWith(prefix));
}

/**
 * Las variables que este servicio va a desdoblar, ya deduplicadas.
 *
 * Se exporta aparte del desdoblado para poder responder «qué secretos ve este
 * contenedor» sin tocar nada, que es la primera pregunta cuando una credencial
 * no aparece.
 */
export function secretVariables(options: UnfoldSecretsOptions = {}): string[] {
  const env = options.env ?? process.env;
  const prefix = options.prefix ?? DEFAULT_SECRET_PREFIX;

  return [
    ...new Set([
      ...(options.variables ?? []),
      ...namedVariables(env),
      ...discovered(env, prefix),
    ]),
  ];
}

/**
 * Desdobla en el entorno los secretos que la plataforma inyecta como JSON.
 *
 * La task definition inyecta cada secreto de Secrets Manager como UNA sola
 * variable con el JSON completo, nunca una variable por clave. ECS permite
 * seleccionar una clave agregando `:CLAVE::` al ARN, pero ningún template de
 * esta cuenta lo usa, así que parsear el JSON es responsabilidad de la
 * aplicación: es el contrato, no un parche.
 *
 * Corre **antes de que exista la aplicación**, porque cada `registerAs` valida
 * sus variables al instanciarse el módulo y para entonces las claves ya tienen
 * que estar puestas. De acá para abajo todo lee variables planas sin enterarse
 * de que hubo un secreto.
 *
 * **Ausente y malformado son casos distintos, a propósito.** Un secreto ausente
 * no falla: es lo que permite que una corrida local y los tests funcionen con
 * sus propias variables. Un JSON roto corta el arranque, que es lo contrario de
 * lo intuitivo y es lo correcto — dejarlo pasar en silencio produce un
 * contenedor que muere sin decir por qué, el fallo más caro de diagnosticar de
 * esta familia.
 *
 * @returns los nombres de las variables que traían un secreto y se desdoblaron.
 * @throws {SecretUnfoldError} cuando una de ellas no es un objeto JSON.
 *
 * @example
 * // Descubre por convención: cualquier SECRET_* que la task definition inyecte.
 * unfoldSecrets();
 *
 * // Un secreto que no sigue la convención, sumado a los que sí.
 * unfoldSecrets({ variables: ['LEGACY_CREDENTIALS'] });
 */
export function unfoldSecrets(options: UnfoldSecretsOptions = {}): string[] {
  const env = options.env ?? process.env;
  const override = options.override ?? true;
  const unfolded: string[] = [];

  for (const variable of secretVariables(options)) {
    const raw = env[variable];
    if (raw === undefined || raw.trim() === '') {
      continue;
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      // El error original se descarta a propósito: `JSON.parse` cita el texto
      // que no pudo leer, y ese texto es el secreto.
      throw new SecretUnfoldError(variable, 'could not be parsed as JSON');
    }

    if (
      typeof parsed !== 'object' ||
      parsed === null ||
      Array.isArray(parsed)
    ) {
      throw new SecretUnfoldError(variable, 'does not contain a JSON object');
    }

    for (const [key, value] of Object.entries(parsed)) {
      if (!override && env[key] !== undefined) {
        continue;
      }
      // Lo que no es escalar se descarta en vez de convertirse en
      // "[object Object]", que pasaría cualquier validación llevando basura.
      if (value !== null && typeof value !== 'object') {
        env[key] = String(value);
      }
    }

    unfolded.push(variable);
  }

  return unfolded;
}
