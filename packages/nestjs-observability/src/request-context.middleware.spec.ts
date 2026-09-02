import { RequestContextMiddleware } from './request-context.middleware';
import { RequestContextService } from './request-context.service';
import { resolveObservabilityOptions } from './tokens';

describe('RequestContextMiddleware', () => {
  let service: RequestContextService;

  beforeEach(() => {
    service = new RequestContextService();
  });

  function middleware(
    options: Parameters<typeof resolveObservabilityOptions>[0] = {},
  ): RequestContextMiddleware {
    return new RequestContextMiddleware(
      service,
      resolveObservabilityOptions({
        generateId: () => 'generated-id',
        ...options,
      }),
    );
  }

  it('opens the context for the rest of the chain', () => {
    const next = jest.fn(() => {
      expect(service.requestId()).toBe('req-1');
    });

    middleware().use(
      { headers: { 'x-request-id': 'req-1' } },
      { setHeader: jest.fn() },
      next,
    );

    expect(next).toHaveBeenCalledTimes(1);
  });

  // The caller needs the id to report a failure, and a browser can only read it
  // because the CORS policy exposes that header.
  it('echoes the correlation id back on the response', () => {
    const setHeader = jest.fn();

    middleware().use({ headers: {} }, { setHeader }, jest.fn());

    expect(setHeader).toHaveBeenCalledWith('x-request-id', 'generated-id');
  });

  it('can be told not to echo it', () => {
    const setHeader = jest.fn();

    middleware({ echoRequestId: false }).use(
      { headers: {} },
      { setHeader },
      jest.fn(),
    );

    expect(setHeader).not.toHaveBeenCalled();
  });

  // A platform whose response object has no setHeader must not take the
  // request down over an echo that is a convenience.
  it('still serves when the response cannot take headers', () => {
    const next = jest.fn();

    expect(() => middleware().use({ headers: {} }, {}, next)).not.toThrow();
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('echoes under the configured header name', () => {
    const setHeader = jest.fn();

    middleware({ correlationHeaders: ['x-correlation-id'] }).use(
      { headers: {} },
      { setHeader },
      jest.fn(),
    );

    expect(setHeader).toHaveBeenCalledWith('x-correlation-id', 'generated-id');
  });
});

describe('resolveObservabilityOptions', () => {
  it('applies the defaults', () => {
    const options = resolveObservabilityOptions();

    expect(options.correlationHeaders).toEqual([
      'x-request-id',
      'x-user-id',
      'x-tenant-id',
    ]);
    expect(options.echoRequestId).toBe(true);
    expect(options.generateId()).toEqual(expect.any(String));
  });

  it('keeps a default when a field is explicitly undefined', () => {
    expect(
      resolveObservabilityOptions({ echoRequestId: undefined }).echoRequestId,
    ).toBe(true);
  });

  it('generates a distinct id each time by default', () => {
    const { generateId } = resolveObservabilityOptions();

    expect(generateId()).not.toBe(generateId());
  });
});
