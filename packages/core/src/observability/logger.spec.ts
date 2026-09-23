import {
  SENSITIVE_HEADERS,
  createRequestLoggerOptions,
  type RequestLoggerOptions,
} from './logger';

type Redact = { paths: string[]; censor: string };

/**
 * Las opciones de pino, ya separadas del destino cuando lo hay: `pinoHttp` es
 * o el objeto de opciones o la tupla `[opciones, destino]`.
 */
function pinoHttp(options: RequestLoggerOptions = {}): Record<string, unknown> {
  const params = createRequestLoggerOptions(options).pinoHttp;
  return Array.isArray(params) ? params[0] : params;
}

function redact(options: RequestLoggerOptions = {}): Redact {
  return pinoHttp(options)['redact'] as Redact;
}

describe('createRequestLoggerOptions', () => {
  it('defaults to the info level', () => {
    expect(pinoHttp()['level']).toBe('info');
    expect(pinoHttp({ level: 'debug' })['level']).toBe('debug');
  });

  // A log index is read by more people than the database it protects, and a
  // token pasted into a search box is a working credential.
  it.each(SENSITIVE_HEADERS)('redacts %s in both directions', (header) => {
    const paths = redact().paths;

    expect(paths).toContain(`req.headers["${header}"]`);
    expect(paths).toContain(`res.headers["${header}"]`);
  });

  it('redacts the extra headers a service declares', () => {
    const paths = redact({ redactHeaders: ['x-student-document'] }).paths;

    expect(paths).toContain('req.headers["x-student-document"]');
    expect(paths).toContain('req.headers["authorization"]');
  });

  it('censors rather than dropping, so the header is visibly hidden', () => {
    expect(redact().censor).toBe('[redacted]');
  });

  // One id has to follow a call across services; a logger that mints its own
  // breaks the trace at every hop.
  it('takes the request id from the context when there is one', () => {
    const genReqId = pinoHttp({ requestId: () => 'req-1' })[
      'genReqId'
    ] as () => string;

    expect(genReqId()).toBe('req-1');
  });

  it('falls back to a generated id outside a request', () => {
    const genReqId = pinoHttp({ requestId: () => undefined })[
      'genReqId'
    ] as () => string;

    expect(genReqId()).toEqual(expect.any(String));
  });

  it('reads the id from the first of several headers that carries one', () => {
    const genReqId = pinoHttp({
      requestIdHeader: ['transaction-id', 'x-request-id'],
    })['genReqId'] as (request: unknown) => string;

    expect(genReqId({ headers: { 'x-request-id': 'r-1' } })).toBe('r-1');
    expect(
      genReqId({
        headers: { 'transaction-id': 'tx-1', 'x-request-id': 'r-1' },
      }),
    ).toBe('tx-1');
  });

  // Fixed messages, because the searchable part of a request log is the
  // structured fields; a message that interpolates the path makes every line
  // unique and the aggregation useless.
  it('reports one message for a completed request and one for a failed one', () => {
    const params = pinoHttp();
    const success = params['customSuccessMessage'] as () => string;
    const error = params['customErrorMessage'] as () => string;

    expect(success()).toBe('request completed');
    expect(error()).toBe('request errored');
  });

  // pino escribe al descriptor 1 con sonic-boom, así que un destino propio es
  // la única forma de leer lo que emitió -- desde un test, o para escribir a
  // otro lado. Va como segundo elemento de la tupla, que es como lo espera
  // nestjs-pino.
  it('passes a destination through as the second element', () => {
    const destination = { write: vi.fn() };
    const params = createRequestLoggerOptions({ destination }).pinoHttp;

    expect(Array.isArray(params)).toBe(true);
    expect((params as [unknown, unknown])[1]).toBe(destination);
  });

  it('stays a plain object when no destination is given', () => {
    expect(Array.isArray(createRequestLoggerOptions().pinoHttp)).toBe(false);
  });

  // A container's log collector expects one JSON document per line, so pretty
  // printing must never be on by default.
  it('adds the pretty transport only when asked', () => {
    expect(pinoHttp()['transport']).toBeUndefined();
    expect(pinoHttp({ pretty: true })['transport']).toMatchObject({
      target: 'pino-pretty',
    });
  });
});
