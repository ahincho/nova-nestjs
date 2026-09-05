import type { HealthIndicatorFunction } from '@nestjs/terminus';

export const HEALTH_OPTIONS = Symbol('NOVA_HEALTH_OPTIONS');

/**
 * Una cosa de la que depende estar listo.
 *
 * Devolver `false` y lanzar significan lo mismo para la sonda; un chequeo no
 * tiene que protegerse solo. Es la forma corta de escribir un indicador; para
 * los que trae terminus (memoria, disco, bases de datos) está
 * `readinessIndicators`.
 */
export type ReadinessCheck = {
  readonly name: string;
  check(): boolean | Promise<boolean>;
};

export type NovaHealthModuleOptions = {
  /**
   * Prefijo de las sondas. Por defecto `health`, que da `/health/live` y
   * `/health/ready`.
   *
   * Moverlo es mover el target group del balanceador al mismo tiempo. Una
   * sonda que responde 404 desregistra la tarea unos nueve segundos después de
   * registrarla, y el despliegue muere diez minutos más tarde con un timeout
   * que se lee como un problema de recursos.
   */
  readonly path?: string;
  /**
   * Ruta heredada que un target group ya existente revisa, por ejemplo
   * `api/v1/health`. No se monta si no se indica. Responde igual que `ready`:
   * es la que decide si la tarea recibe tráfico, así que tiene que caer con los
   * chequeos y durante el apagado.
   */
  readonly legacyPath?: string;
  /**
   * De qué depende estar listo. Vacío significa que el servicio está listo en
   * cuanto escucha.
   */
  readonly readinessChecks?: readonly ReadinessCheck[];
  /**
   * Indicadores nativos de terminus, para los que ya vienen hechos:
   * `MemoryHealthIndicator`, `DiskHealthIndicator`, los de bases de datos.
   */
  readonly readinessIndicators?: readonly HealthIndicatorFunction[];
  /**
   * Cuánto puede tardar un chequeo. Por defecto 2000.
   *
   * Un chequeo sin fecha límite puede colgar la sonda, y una sonda que nunca
   * contesta es peor que una que dice "no estoy lista": el balanceador espera
   * su propio timeout en cada intento.
   */
  readonly checkTimeoutMs?: number;
  /**
   * Cuánto se demora el apagado después de SIGTERM, en milisegundos. Durante
   * esa ventana `ready` y la ruta heredada responden 503 con
   * `status: 'shutting_down'`, para que el balanceador deje de enviar tráfico
   * antes de que el proceso cierre. Por defecto 0: se apaga de inmediato.
   *
   * Conviene un valor algo mayor que el intervalo de la sonda del target
   * group, y menor que el `stopTimeout` de la tarea.
   */
  readonly gracefulShutdownTimeoutMs?: number;
};

export type ResolvedHealthOptions = {
  readonly path: string;
  readonly legacyPath: string | undefined;
  readonly readinessChecks: readonly ReadinessCheck[];
  readonly readinessIndicators: readonly HealthIndicatorFunction[];
  readonly checkTimeoutMs: number;
  readonly gracefulShutdownTimeoutMs: number;
};

export const DEFAULT_HEALTH_PATH = 'health';
export const DEFAULT_CHECK_TIMEOUT_MS = 2000;
export const DEFAULT_GRACEFUL_SHUTDOWN_TIMEOUT_MS = 0;

export function resolveHealthOptions(
  options: NovaHealthModuleOptions = {},
): ResolvedHealthOptions {
  return {
    path: options.path ?? DEFAULT_HEALTH_PATH,
    legacyPath: options.legacyPath,
    readinessChecks: options.readinessChecks ?? [],
    readinessIndicators: options.readinessIndicators ?? [],
    checkTimeoutMs: options.checkTimeoutMs ?? DEFAULT_CHECK_TIMEOUT_MS,
    gracefulShutdownTimeoutMs:
      options.gracefulShutdownTimeoutMs ?? DEFAULT_GRACEFUL_SHUTDOWN_TIMEOUT_MS,
  };
}
