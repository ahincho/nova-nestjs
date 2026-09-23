import type { Type } from '@nestjs/common';
import type { ApiStandard } from '../api-standard';

/**
 * DI token holding the resolved {@link ApiStandardModuleOptions}.
 */
export const API_STANDARD_OPTIONS = Symbol('NOVA_API_STANDARD_OPTIONS');

/**
 * Token del {@link ApiStandard} activo: el que le da forma a todo lo que el
 * servicio contesta.
 */
export const API_STANDARD = Symbol('NOVA_API_STANDARD');

/**
 * Options accepted by `ApiStandardModule.forRoot()`.
 */
export type ApiStandardModuleOptions = {
  /**
   * El estándar con el que contesta el servicio. Omitirlo usa el sobre de Nova,
   * `NovaEnvelopeStandard`.
   *
   * Acepta una instancia o una clase. Una clase se resuelve por inyección, así
   * que puede recibir dependencias; una instancia es para el estándar que se
   * arma con opciones fijas, como un catálogo de códigos propio.
   *
   * Reemplazarlo cambia la forma del cuerpo y nada más: qué respuestas pasan
   * por el estándar y qué se le dice al cliente en un 5xx siguen siendo reglas
   * de la plataforma.
   */
  readonly standard?: ApiStandard | Type<ApiStandard>;

  /**
   * Registers the global response interceptor. Defaults to `true`.
   *
   * @deprecated Para contestar con otra forma, declarar `standard`. Apagar el
   * interceptor se lleva con él las reglas -el caso que no es HTTP,
   * `@SkipResponseWrapper()`, el doble sobre- y el servicio las tiene que
   * reescribir. Sigue funcionando mientras tanto.
   */
  readonly wrapResponses?: boolean;

  /**
   * Registers the global exception filter. Defaults to `true`.
   *
   * @deprecated Para contestar los errores con otra forma, declarar
   * `standard`. Apagar el filtro se lleva el saneado de los 5xx, que es
   * justamente lo que un servicio no debería tener que reescribir. Sigue
   * funcionando mientras tanto.
   */
  readonly catchExceptions?: boolean;

  /**
   * Message reported for any 5xx. It reaches the client verbatim, so it must
   * never carry the underlying failure. Defaults to `'Internal server error'`.
   */
  readonly internalErrorMessage?: string;
};

/**
 * {@link ApiStandardModuleOptions} with every default applied.
 *
 * `standard` no está: no es una opción que se resuelva sino un proveedor, y
 * vive bajo {@link API_STANDARD}.
 */
export type ResolvedApiStandardOptions = Required<
  Omit<ApiStandardModuleOptions, 'standard'>
>;

export const DEFAULT_API_STANDARD_OPTIONS: ResolvedApiStandardOptions = {
  wrapResponses: true,
  catchExceptions: true,
  internalErrorMessage: 'Internal server error',
};

/**
 * Applies defaults field by field.
 *
 * Not a spread: `{ ...defaults, ...options }` lets an explicitly passed
 * `undefined` overwrite a default with `undefined`, which then reads as
 * "disabled" at every call site.
 */
export function resolveApiStandardOptions(
  options: ApiStandardModuleOptions = {},
): ResolvedApiStandardOptions {
  return {
    wrapResponses:
      options.wrapResponses ?? DEFAULT_API_STANDARD_OPTIONS.wrapResponses,
    catchExceptions:
      options.catchExceptions ?? DEFAULT_API_STANDARD_OPTIONS.catchExceptions,
    internalErrorMessage:
      options.internalErrorMessage ??
      DEFAULT_API_STANDARD_OPTIONS.internalErrorMessage,
  };
}
