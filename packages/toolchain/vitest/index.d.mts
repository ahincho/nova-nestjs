import type { UserConfig } from 'vitest/config';

/**
 * Opciones del preset de Vitest de Nova Platform.
 *
 * Este archivo existe porque `index.mjs` es JavaScript: sin declaracion, el
 * `import` desde el `vitest.config.mjs` de un servicio llega como `error` y
 * `oxlint --type-aware` lo marca con `no-unsafe-call`. Ademas es lo que hace
 * que el editor sepa que opciones acepta la fabrica.
 */
export interface NovaVitestOptions {
  /** Patrones de archivos de test. Por defecto `['src/**\/*.spec.ts']`. */
  include?: string[];
  /** Fuentes que entran a la medicion. Por defecto `['src/**\/*.ts']`. */
  coverageInclude?: string[];
  /**
   * La lista **completa** de exclusiones de cobertura, no un agregado a la de
   * por defecto, que es `['**\/*.spec.ts']`.
   */
  coverageExclude?: string[];
  /** Umbral global, o `false` para no exigir ninguno. Por defecto 80 %. */
  thresholds?: Record<string, number> | false;
  /**
   * Modulos que se cargan antes de los tests. Por defecto
   * `['reflect-metadata']`; un paquete sin decoradores pasa `[]`.
   */
  setupFiles?: string[];
  /**
   * Limite por test y por hook. Por defecto 20 s, no los 5 s de Vitest: el
   * primer test de cada archivo paga la carga del grafo de modulos de NestJS.
   */
  timeoutMs?: number;
}

export declare function novaVitestConfig(
  options?: NovaVitestOptions,
): UserConfig;

declare const config: UserConfig;
export default config;
