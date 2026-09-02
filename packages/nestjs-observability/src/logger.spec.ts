import { SENSITIVE_HEADERS, createRequestLoggerOptions } from './logger';

type Redact = { paths: string[]; censor: string };

function redact(params: ReturnType<typeof createRequestLoggerOptions>): Redact {
  return params.pinoHttp['redact'] as Redact;
}

describe('createRequestLoggerOptions', () => {
  it('defaults to the info level', () => {
    expect(createRequestLoggerOptions().pinoHttp['level']).toBe('info');
    expect(
      createRequestLoggerOptions({ level: 'debug' }).pinoHttp['level'],
    ).toBe('debug');
  });

  // A log index is read by more people than the database it protects, and a
  // token pasted into a search box is a working credential.
  it.each(SENSITIVE_HEADERS)('redacts %s in both directions', (header) => {
    const paths = redact(createRequestLoggerOptions()).paths;

    expect(paths).toContain(`req.headers["${header}"]`);
    expect(paths).toContain(`res.headers["${header}"]`);
  });

  it('redacts the extra headers a service declares', () => {
    const paths = redact(
      createRequestLoggerOptions({ redactHeaders: ['x-student-document'] }),
    ).paths;

    expect(paths).toContain('req.headers["x-student-document"]');
    expect(paths).toContain('req.headers["authorization"]');
  });

  it('censors rather than dropping, so the header is visibly hidden', () => {
    expect(redact(createRequestLoggerOptions()).censor).toBe('[redacted]');
  });

  // One id has to follow a call across services; a logger that mints its own
  // breaks the trace at every hop.
  it('takes the request id from the context when there is one', () => {
    const params = createRequestLoggerOptions({ requestId: () => 'req-1' });
    const genReqId = params.pinoHttp['genReqId'] as () => string;

    expect(genReqId()).toBe('req-1');
  });

  it('falls back to a generated id outside a request', () => {
    const params = createRequestLoggerOptions({ requestId: () => undefined });
    const genReqId = params.pinoHttp['genReqId'] as () => string;

    expect(genReqId()).toEqual(expect.any(String));
  });

  // Fixed messages, because the searchable part of a request log is the
  // structured fields; a message that interpolates the path makes every line
  // unique and the aggregation useless.
  it('reports one message for a completed request and one for a failed one', () => {
    const params = createRequestLoggerOptions();
    const success = params.pinoHttp['customSuccessMessage'] as () => string;
    const error = params.pinoHttp['customErrorMessage'] as () => string;

    expect(success()).toBe('request completed');
    expect(error()).toBe('request errored');
  });

  // A container's log collector expects one JSON document per line, so pretty
  // printing must never be on by default.
  it('adds the pretty transport only when asked', () => {
    expect(createRequestLoggerOptions().pinoHttp['transport']).toBeUndefined();
    expect(
      createRequestLoggerOptions({ pretty: true }).pinoHttp['transport'],
    ).toMatchObject({ target: 'pino-pretty' });
  });
});
