import {
  BadGatewayException,
  GatewayTimeoutException,
  Logger,
} from '@nestjs/common';
import { HttpClientService } from './http-client.service';
import { resolveNovaHttpOptions, type OutboundHeadersProvider } from './tokens';
import { UpstreamHttpError } from './upstream-http.error';

type FetchArgs = [string, RequestInit];

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', 'x-upstream': 'academic' },
  });
}

function timeoutError(): Error {
  const error = new Error('The operation was aborted due to timeout');
  error.name = 'TimeoutError';
  return error;
}

describe('HttpClientService', () => {
  let fetchMock: jest.Mock;

  beforeEach(() => {
    fetchMock = jest.fn();
    global.fetch = fetchMock as unknown as typeof fetch;
    jest.spyOn(Logger.prototype, 'error').mockImplementation();
    jest.spyOn(Logger.prototype, 'warn').mockImplementation();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  function client(
    headersProvider?: OutboundHeadersProvider,
    timeoutMs = 5000,
  ): HttpClientService {
    return new HttpClientService(
      resolveNovaHttpOptions({ defaultTimeoutMs: timeoutMs }),
      headersProvider,
    );
  }

  function lastCall(): FetchArgs {
    return fetchMock.mock.calls[fetchMock.mock.calls.length - 1] as FetchArgs;
  }

  describe('a successful call', () => {
    it('parses the JSON body', async () => {
      fetchMock.mockResolvedValue(jsonResponse({ id: 7 }));

      await expect(
        client().get('http://academic.internal/courses'),
      ).resolves.toEqual({ id: 7 });
    });

    // The body has to be null, not '': a Response with a null-body status and
    // any body at all throws on construction.
    it('returns undefined for an empty body', async () => {
      fetchMock.mockResolvedValue(new Response(null, { status: 204 }));

      await expect(
        client().delete('http://academic.internal/courses/7'),
      ).resolves.toBeUndefined();
    });

    // A gateway answering HTML where JSON was expected is the usual case, and
    // the text is more useful to whoever debugs it than a parse error.
    it('returns the raw text when the body is not JSON', async () => {
      fetchMock.mockResolvedValue(new Response('<html>502</html>'));

      await expect(client().get('http://academic.internal')).resolves.toBe(
        '<html>502</html>',
      );
    });

    it('serialises the body of a POST', async () => {
      fetchMock.mockResolvedValue(jsonResponse({ ok: true }, 201));

      await client().post('http://academic.internal/enrollments', {
        studentId: 7,
      });

      expect(lastCall()[1].body).toBe('{"studentId":7}');
      expect(lastCall()[1].method).toBe('POST');
    });

    it('sends no body on a GET', async () => {
      fetchMock.mockResolvedValue(jsonResponse({}));

      await client().get('http://academic.internal/courses');

      expect(lastCall()[1].body).toBeUndefined();
    });
  });

  describe('the query string', () => {
    it('appends the entries that carry a value', async () => {
      fetchMock.mockResolvedValue(jsonResponse([]));

      await client().get('http://academic.internal/courses', {
        query: { periodId: 202, active: true, search: undefined, tag: null },
      });

      expect(lastCall()[0]).toBe(
        'http://academic.internal/courses?periodId=202&active=true',
      );
    });

    it('joins onto a URL that already has a query', async () => {
      fetchMock.mockResolvedValue(jsonResponse([]));

      await client().get('http://academic.internal/courses?page=1', {
        query: { size: 20 },
      });

      expect(lastCall()[0]).toBe(
        'http://academic.internal/courses?page=1&size=20',
      );
    });

    it('leaves the URL alone when every entry is empty', async () => {
      fetchMock.mockResolvedValue(jsonResponse([]));

      await client().get('http://academic.internal/courses', {
        query: { search: undefined },
      });

      expect(lastCall()[0]).toBe('http://academic.internal/courses');
    });
  });

  describe('headers', () => {
    // This is the whole point of the provider: no call site passes the
    // correlation id, and every outbound call still carries it.
    it('propagates what the provider supplies', async () => {
      fetchMock.mockResolvedValue(jsonResponse({}));

      await client({
        headers: () => ({ 'x-request-id': 'req-1', 'x-user-id': 'u-9' }),
      }).get('http://academic.internal/courses');

      expect(lastCall()[1].headers).toMatchObject({
        'x-request-id': 'req-1',
        'x-user-id': 'u-9',
      });
    });

    it('lets the call site override a propagated header', async () => {
      fetchMock.mockResolvedValue(jsonResponse({}));

      await client({ headers: () => ({ 'x-request-id': 'req-1' }) }).get(
        'http://academic.internal/courses',
        { headers: { 'x-request-id': 'req-override' } },
      );

      expect(lastCall()[1].headers).toMatchObject({
        'x-request-id': 'req-override',
      });
    });

    // Losing the correlation id degrades a trace; failing the call because the
    // context could not be read would turn that into an outage.
    it('still calls when the provider throws', async () => {
      fetchMock.mockResolvedValue(jsonResponse({ id: 7 }));

      const provider: OutboundHeadersProvider = {
        headers: () => {
          throw new Error('no request context');
        },
      };

      await expect(
        client(provider).get('http://academic.internal/courses'),
      ).resolves.toEqual({ id: 7 });
    });

    it('defaults the content type to JSON', async () => {
      fetchMock.mockResolvedValue(jsonResponse({}));

      await client().get('http://academic.internal/courses');

      expect(lastCall()[1].headers).toMatchObject({
        'content-type': 'application/json',
      });
    });
  });

  describe('failures', () => {
    it('translates a timeout into a 504', async () => {
      fetchMock.mockRejectedValue(timeoutError());

      await expect(
        client().get('http://academic.internal/courses'),
      ).rejects.toBeInstanceOf(GatewayTimeoutException);
    });

    it('translates an unreachable upstream into a 502', async () => {
      fetchMock.mockRejectedValue(new Error('ECONNREFUSED'));

      await expect(
        client().get('http://academic.internal/courses'),
      ).rejects.toBeInstanceOf(BadGatewayException);
    });

    // The upstream's own status describes a topology the client should not
    // learn about, so a 404 from the upstream is not a 404 to the caller.
    it.each([400, 401, 403, 404, 409, 500, 503])(
      'hides an upstream %i behind a 502',
      async (status) => {
        fetchMock.mockResolvedValue(jsonResponse({ detail: 'x' }, status));

        await expect(
          client().get('http://academic.internal/courses'),
        ).rejects.toBeInstanceOf(BadGatewayException);
      },
    );

    it.each([408, 504])('reports an upstream %i as a 504', async (status) => {
      fetchMock.mockResolvedValue(jsonResponse({}, status));

      await expect(
        client().get('http://academic.internal/courses'),
      ).rejects.toBeInstanceOf(GatewayTimeoutException);
    });

    it('hands the caller the whole response when it asks to forward', async () => {
      fetchMock.mockResolvedValue(
        jsonResponse({ code: 'STUDENT_NOT_FOUND' }, 404),
      );

      await expect(
        client().get('http://academic.internal/students/7', {
          forwardError: true,
        }),
      ).rejects.toMatchObject({
        name: 'UpstreamHttpError',
        statusCode: 404,
        body: { code: 'STUDENT_NOT_FOUND' },
        headers: expect.objectContaining({ 'x-upstream': 'academic' }),
      });
    });

    it('raises UpstreamHttpError, not a plain Error', async () => {
      fetchMock.mockResolvedValue(jsonResponse({}, 422));

      await expect(
        client().get('http://academic.internal/x', { forwardError: true }),
      ).rejects.toBeInstanceOf(UpstreamHttpError);
    });
  });

  describe('logging', () => {
    // An upstream error payload routinely echoes back the identifiers of the
    // person the request was about, and a query string carries them outright.
    it('never writes the response body or the query string', async () => {
      const errorLog = jest.spyOn(Logger.prototype, 'error');
      fetchMock.mockResolvedValue(
        jsonResponse({ studentEmail: 'someone@example.edu' }, 500),
      );

      await expect(
        client().get('http://academic.internal/students', {
          query: { documentNumber: '70123456' },
        }),
      ).rejects.toBeInstanceOf(BadGatewayException);

      const logged = errorLog.mock.calls.flat().join(' ');
      expect(logged).not.toContain('someone@example.edu');
      expect(logged).not.toContain('70123456');
      expect(logged).toContain('http://academic.internal/students');
      expect(logged).toContain('500');
    });
  });

  describe('timeouts', () => {
    it('applies the module default', async () => {
      fetchMock.mockResolvedValue(jsonResponse({}));

      await client(undefined, 1500).get('http://academic.internal/courses');

      expect(lastCall()[1].signal).toBeInstanceOf(AbortSignal);
    });

    it('lets the call site override it', async () => {
      fetchMock.mockResolvedValue(jsonResponse({}));

      await client(undefined, 1500).get('http://academic.internal/courses', {
        timeoutMs: 50,
      });

      expect(lastCall()[1].signal).toBeInstanceOf(AbortSignal);
    });
  });
});
