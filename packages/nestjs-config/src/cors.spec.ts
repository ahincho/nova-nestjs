import { buildCorsOptions } from './cors';

describe('buildCorsOptions', () => {
  it('splits and trims the configured origins', () => {
    const options = buildCorsOptions({
      origins: 'https://nova.example.edu , https://qa.nova.example.edu',
    });

    expect(options.origin).toEqual([
      'https://nova.example.edu',
      'https://qa.nova.example.edu',
    ]);
  });

  // A container nobody configured must reject every browser origin rather than
  // accept all of them.
  it('allows nothing when the list is empty', () => {
    expect(buildCorsOptions({ origins: '' }).origin).toEqual([]);
    expect(buildCorsOptions({ origins: '  ,  ' }).origin).toEqual([]);
  });

  // Credentials plus a reflected origin is the combination that leaks a
  // session, and auth here travels in the Authorization header.
  it('never enables credentials', () => {
    expect(
      buildCorsOptions({ origins: 'https://nova.example.edu' }).credentials,
    ).toBe(false);
  });

  it('allows the correlation header by default', () => {
    const options = buildCorsOptions({ origins: 'https://nova.example.edu' });

    expect(options.allowedHeaders).toEqual([
      'Content-Type',
      'Authorization',
      'x-request-id',
    ]);
    expect(options.exposedHeaders).toEqual(['x-request-id']);
  });

  it('appends the extra headers a service declares', () => {
    const options = buildCorsOptions({
      origins: 'https://nova.example.edu',
      allowedHeaders: ['x-tenant-id'],
      exposedHeaders: ['x-request-id', 'x-total-count'],
    });

    expect(options.allowedHeaders).toContain('Authorization');
    expect(options.allowedHeaders).toContain('x-tenant-id');
    expect(options.exposedHeaders).toEqual(['x-request-id', 'x-total-count']);
  });

  // Without it the preflight repeats on every single request, because
  // Authorization is not a simple header.
  it('caches the preflight for a day by default', () => {
    expect(buildCorsOptions({ origins: '' }).maxAge).toBe(86400);
    expect(buildCorsOptions({ origins: '', maxAgeSeconds: 600 }).maxAge).toBe(
      600,
    );
  });
});
