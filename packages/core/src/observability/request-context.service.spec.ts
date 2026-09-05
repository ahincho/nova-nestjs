import { RequestContextService } from './request-context.service';
import type { RequestContext } from './request-context';

const context: RequestContext = {
  requestId: 'req-1',
  headers: { 'x-request-id': 'req-1', 'x-user-id': 'u-9' },
};

describe('RequestContextService', () => {
  let service: RequestContextService;

  beforeEach(() => {
    service = new RequestContextService();
  });

  it('exposes the context to everything running underneath', () => {
    service.run(context, () => {
      expect(service.get()).toEqual(context);
      expect(service.requestId()).toBe('req-1');
    });
  });

  // The point of AsyncLocalStorage over a plain field: the context survives an
  // await without being threaded through every signature.
  it('survives an await', async () => {
    await service.run(context, async () => {
      await new Promise((resolve) => setTimeout(resolve, 1));
      expect(service.requestId()).toBe('req-1');
    });
  });

  it('keeps two concurrent requests apart', async () => {
    const other: RequestContext = {
      requestId: 'req-2',
      headers: { 'x-request-id': 'req-2' },
    };

    const seen = await Promise.all([
      service.run(context, async () => {
        await new Promise((resolve) => setTimeout(resolve, 5));
        return service.requestId();
      }),
      service.run(other, async () => service.requestId()),
    ]);

    expect(seen).toEqual(['req-1', 'req-2']);
  });

  // A scheduled job has no incoming call to correlate with, and inventing one
  // makes a trace claim a relationship that does not exist.
  it('reports nothing outside a request', () => {
    expect(service.get()).toBeUndefined();
    expect(service.requestId()).toBeUndefined();
    expect(service.headers()).toEqual({});
  });

  it('satisfies the outbound headers port', () => {
    service.run(context, () => {
      expect(service.headers()).toEqual({
        'x-request-id': 'req-1',
        'x-user-id': 'u-9',
      });
    });
  });

  // Handing out the stored object would let one caller's mutation reach every
  // later request on the same context.
  it('hands out a copy of the headers', () => {
    service.run(context, () => {
      const headers = service.headers();
      headers['x-request-id'] = 'tampered';

      expect(service.headers()['x-request-id']).toBe('req-1');
    });
  });
});
