import { EnvironmentError, requireEnv } from './environment';

/**
 * Los ambientes donde corre un servicio de la plataforma.
 *
 * No es `NODE_ENV`, y confundirlos es el error que esto existe para evitar.
 * `NODE_ENV` le dice a Node y a las librerías si el artefacto es de producción,
 * y vale `production` en los tres: la imagen que se probó en dev es la misma
 * que llega a prod, byte por byte.
 */
export const APP_ENVIRONMENTS = ['dev', 'qa', 'prod'] as const;

export type AppEnvironment = (typeof APP_ENVIRONMENTS)[number];

/** La variable que lo lleva, inyectada por la task definition. */
export const APP_ENV_VARIABLE = 'APP_ENV';

function isAppEnvironment(value: string): value is AppEnvironment {
  return (APP_ENVIRONMENTS as readonly string[]).includes(value);
}

/**
 * El ambiente donde corre este contenedor.
 *
 * **No tiene valor por defecto, a propósito.** Es lo que hace confiable la
 * imagen única: un contenedor sin `APP_ENV` no arranca, y el error nombra la
 * variable. Con un valor por defecto, el que se olvidó de inyectarla en prod
 * arranca creyéndose otra cosa, y eso no se descubre hasta que alguien nota que
 * la documentación está publicada donde no debía.
 *
 * @throws {EnvironmentError} cuando falta o no es uno de los tres.
 *
 * @example
 * void bootstrap(AppModule, {
 *   openapi: { title: 'Academic ACL', enabled: appEnvironment() !== 'prod' },
 * });
 */
export function appEnvironment(): AppEnvironment {
  const value = requireEnv(APP_ENV_VARIABLE).toLowerCase();

  if (!isAppEnvironment(value)) {
    throw new EnvironmentError(
      APP_ENV_VARIABLE,
      `must be one of ${APP_ENVIRONMENTS.join(', ')}, but was "${value}"`,
    );
  }

  return value;
}
