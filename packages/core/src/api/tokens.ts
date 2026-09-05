/**
 * DI token holding the resolved {@link ApiStandardModuleOptions}.
 */
export const API_STANDARD_OPTIONS = Symbol('NOVA_API_STANDARD_OPTIONS');

/**
 * Options accepted by `ApiStandardModule.forRoot()`.
 */
export type ApiStandardModuleOptions = {
  /**
   * Registers the global response interceptor. Turn it off only when the
   * application wraps responses itself. Defaults to `true`.
   */
  readonly wrapResponses?: boolean;

  /**
   * Registers the global exception filter. Defaults to `true`.
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
 */
export type ResolvedApiStandardOptions = Required<ApiStandardModuleOptions>;

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
