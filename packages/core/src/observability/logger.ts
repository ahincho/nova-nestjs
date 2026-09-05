/**
 * Headers that must never reach a log.
 *
 * `authorization` carries a live token: a log index is read by more people than
 * the database it protects, and a token pasted into a search box is a working
 * credential. The rest are the same problem in other clothes.
 */
export const SENSITIVE_HEADERS = [
  'authorization',
  'proxy-authorization',
  'cookie',
  'set-cookie',
  'x-api-key',
] as const;

export type RequestLoggerOptions = {
  /** pino level. Defaults to `info`. */
  readonly level?: string;

  /**
   * Human-readable output for local development. Never turn it on in a
   * container: the log collector expects one JSON document per line.
   */
  readonly pretty?: boolean;

  /** Extra headers to redact, on top of {@link SENSITIVE_HEADERS}. */
  readonly redactHeaders?: readonly string[];

  /** Reads the correlation id of the request in flight. */
  readonly requestId?: () => string | undefined;
};

/**
 * The shape `nestjs-pino` expects, declared structurally.
 *
 * Declaring it rather than importing keeps `nestjs-pino` and `pino` optional:
 * a service that logs another way can ignore this factory and the package still
 * installs with no logging dependency at all.
 */
export type RequestLoggerParams = {
  readonly pinoHttp: Record<string, unknown>;
};

function redactionPaths(extra: readonly string[]): string[] {
  const headers = [...SENSITIVE_HEADERS, ...extra];

  // Both directions are listed because pino cannot know which of the two a
  // given entry came from, and a token redacted on the way in that reappears on
  // the way out has not been redacted.
  return headers.flatMap((header) => [
    `req.headers["${header}"]`,
    `res.headers["${header}"]`,
  ]);
}

/**
 * Builds the pino options every Nova service logs through.
 *
 * @example
 * LoggerModule.forRoot(
 *   createRequestLoggerOptions({
 *     level: process.env.LOG_LEVEL,
 *     requestId: () => context.requestId(),
 *   }),
 * );
 */
export function createRequestLoggerOptions(
  options: RequestLoggerOptions = {},
): RequestLoggerParams {
  const pinoHttp: Record<string, unknown> = {
    level: options.level ?? 'info',
    redact: {
      paths: redactionPaths(options.redactHeaders ?? []),
      censor: '[redacted]',
    },
    // Tying the log's request id to the same context the outbound headers read
    // is what makes one id follow a call across services instead of each hop
    // inventing its own.
    genReqId: () => options.requestId?.() ?? crypto.randomUUID(),
    customSuccessMessage: () => 'request completed',
    customErrorMessage: () => 'request errored',
  };

  if (options.pretty === true) {
    pinoHttp['transport'] = {
      target: 'pino-pretty',
      options: {
        singleLine: true,
        colorize: true,
        translateTime: 'SYS:standard',
      },
    };
  }

  return { pinoHttp };
}
