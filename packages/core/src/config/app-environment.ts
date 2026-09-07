import { EnvironmentError, optionalEnv } from './environment';

/**
 * Los ambientes donde corre un servicio de la plataforma.
 *
 * Los valores son los que inyectan las task definitions de verdad -`development`
 * y `qa` en los siete BFF de hoy-, no una convención inventada acá. `production`
 * es el que trae la imagen y el que usará prd cuando exista.
 */
export const APP_ENVIRONMENTS = ['development', 'qa', 'production'] as const;

export type AppEnvironment = (typeof APP_ENVIRONMENTS)[number];

/** La variable que lo lleva, inyectada por la task definition. */
export const ENVIRONMENT_VARIABLE = 'NODE_ENV';

/**
 * Lo que trae la imagen cuando nadie inyecta nada.
 *
 * Es el más restrictivo a propósito: un contenedor sin configurar se comporta
 * como producción -sin documentación publicada, por ejemplo- en vez de abrirse.
 */
export const DEFAULT_APP_ENVIRONMENT: AppEnvironment = 'production';

function isAppEnvironment(value: string): value is AppEnvironment {
  return (APP_ENVIRONMENTS as readonly string[]).includes(value);
}

/**
 * El ambiente donde corre este contenedor.
 *
 * Es lo que hace que **una sola imagen sirva para los tres**: el artefacto que
 * se aprobó en dev es el que llega a prod, byte por byte, y lo único que cambia
 * es la variable que inyecta la task definition.
 *
 * No acepta un valor fuera de la lista. Un `NODE_ENV=dev` mal escrito no es
 * «algo que no es producción»: es una task definition rota, y conviene que el
 * contenedor lo diga al arrancar en vez de comportarse de una forma que nadie
 * pidió.
 *
 * @throws {EnvironmentError} cuando el valor no es uno de los tres.
 *
 * @example
 * void bootstrap(AppModule, {
 *   openapi: {
 *     title: 'Academic ACL',
 *     enabled: appEnvironment() !== 'production',
 *   },
 * });
 */
export function appEnvironment(): AppEnvironment {
  const value = optionalEnv(
    ENVIRONMENT_VARIABLE,
    DEFAULT_APP_ENVIRONMENT,
  ).toLowerCase();

  if (!isAppEnvironment(value)) {
    throw new EnvironmentError(
      ENVIRONMENT_VARIABLE,
      `must be one of ${APP_ENVIRONMENTS.join(', ')}, but was "${value}"`,
    );
  }

  return value;
}
