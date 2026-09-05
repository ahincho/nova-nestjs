import {
  DEFAULT_CORRELATION_HEADERS,
  buildRequestContext,
} from './request-context';

const generateId = () => 'generated-id';

function build(headers: Record<string, string | string[] | undefined>) {
  return buildRequestContext(headers, DEFAULT_CORRELATION_HEADERS, generateId);
}

describe('buildRequestContext', () => {
  it('keeps the correlation id the caller sent', () => {
    const context = build({ 'x-request-id': 'req-1' });

    expect(context.requestId).toBe('req-1');
    expect(context.headers).toEqual({ 'x-request-id': 'req-1' });
  });

  it('generates an id when the caller sent none', () => {
    const context = build({});

    expect(context.requestId).toBe('generated-id');
    expect(context.headers['x-request-id']).toBe('generated-id');
  });

  // Node lowercases incoming header names, but a hand-built request or another
  // runtime does not, and a context that misses the id silently starts a new
  // trace halfway through a call.
  it('reads header names case-insensitively', () => {
    expect(build({ 'X-Request-Id': 'req-1' }).requestId).toBe('req-1');
  });

  it('carries the other correlation headers the caller sent', () => {
    const context = build({
      'x-request-id': 'req-1',
      'x-user-id': 'u-9',
      'x-tenant-id': 't-3',
    });

    expect(context.headers).toEqual({
      'x-request-id': 'req-1',
      'x-user-id': 'u-9',
      'x-tenant-id': 't-3',
    });
  });

  // An empty `x-user-id` downstream reads as "there is a user and it has no
  // id", which is worse than saying nothing.
  it('leaves out a header that is absent or empty', () => {
    const context = build({ 'x-request-id': 'req-1', 'x-user-id': '' });

    expect(context.headers).not.toHaveProperty('x-user-id');
  });

  it('takes the first value of a repeated header', () => {
    expect(build({ 'x-request-id': ['req-1', 'req-2'] }).requestId).toBe(
      'req-1',
    );
  });

  it('carries nothing but the id when the list says so', () => {
    const context = buildRequestContext(
      { 'x-correlation-id': 'c-1', 'x-user-id': 'u-9' },
      ['x-correlation-id'],
      generateId,
    );

    expect(context.headers).toEqual({ 'x-correlation-id': 'c-1' });
  });

  it('falls back to x-request-id when the list is empty', () => {
    expect(build({}).headers).toHaveProperty('x-request-id');
    expect(buildRequestContext({}, [], generateId).headers).toEqual({
      'x-request-id': 'generated-id',
    });
  });
});
