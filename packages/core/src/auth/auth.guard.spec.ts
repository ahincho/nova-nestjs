import { UnauthorizedException, type ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RequestContextService } from '../observability';
import { NovaAuthGuard, type AuthenticatedRequest } from './auth.guard';
import { Public } from './public.decorator';
import { resolveAuthOptions, type NovaAuthModuleOptions } from './tokens';

function token(claims: unknown): string {
  const payload = Buffer.from(JSON.stringify(claims)).toString('base64url');
  return `header.${payload}.signature`;
}

const student = token({
  preferred_username: '@U12345',
  realm_access: { roles: ['student'] },
});

class SampleController {
  @Public()
  open(): void {}

  closed(): void {}
}

@Public()
class OpenController {
  anything(): void {}
}

function request(headers: Record<string, string> = {}): AuthenticatedRequest {
  return { headers };
}

function execution(
  target: AuthenticatedRequest,
  handler: () => void = SampleController.prototype.closed,
  controller: unknown = SampleController,
): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => target }),
    getHandler: () => handler,
    getClass: () => controller,
  } as unknown as ExecutionContext;
}

function guard(
  options: NovaAuthModuleOptions = { preferredRoles: ['student'] },
  context?: RequestContextService,
): NovaAuthGuard {
  return new NovaAuthGuard(
    resolveAuthOptions(options),
    new Reflector(),
    context,
  );
}

describe('NovaAuthGuard', () => {
  describe('a protected route', () => {
    it('resolves who is calling onto the request', async () => {
      const target = request({ authorization: `Bearer ${student}` });

      await expect(guard().canActivate(execution(target))).resolves.toBe(true);
      expect(target.user).toEqual({
        id: 'U12345',
        role: 'student',
        claims: expect.any(Object) as object,
      });
    });

    // Express normaliza las cabeceras a minúsculas, pero el guard tipa una
    // petición estructural y no puede darlo por hecho.
    it('reads the header whatever its case', async () => {
      const target = request({ Authorization: `Bearer ${student}` });

      await expect(guard().canActivate(execution(target))).resolves.toBe(true);
      expect(target.user?.id).toBe('U12345');
    });

    it.each([
      ['no authorization header', {}],
      ['another scheme', { authorization: 'Basic dXNlcjpwYXNz' }],
      ['an unreadable token', { authorization: 'Bearer not-a-jwt' }],
      [
        'a token with no identifier',
        {
          authorization: `Bearer ${token({ realm_access: { roles: ['a'] } })}`,
        },
      ],
    ])('is rejected with %s', async (_case, headers) => {
      await expect(
        guard().canActivate(execution(request(headers))),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('a public route', () => {
    it('goes through with no token at all', async () => {
      const target = request();
      const context = execution(target, SampleController.prototype.open);

      await expect(guard().canActivate(context)).resolves.toBe(true);
      expect(target.user).toBeUndefined();
    });

    it('can be declared on the whole controller', async () => {
      const context = execution(
        request(),
        OpenController.prototype.anything,
        OpenController,
      );

      await expect(guard().canActivate(context)).resolves.toBe(true);
    });
  });

  describe('the request context', () => {
    it('carries the identifier towards the upstreams', async () => {
      const context = new RequestContextService();
      const target = request({ authorization: `Bearer ${student}` });

      await context.run(
        { requestId: 'req-1', headers: { 'x-request-id': 'req-1' } },
        async () => {
          await guard(undefined, context).canActivate(execution(target));
          expect(context.headers()).toEqual({
            'x-request-id': 'req-1',
            'x-user-id': 'U12345',
          });
        },
      );
    });

    it('can use another header', async () => {
      const context = new RequestContextService();
      const target = request({ authorization: `Bearer ${student}` });

      await context.run({ requestId: 'req-1', headers: {} }, async () => {
        const custom = guard(
          { preferredRoles: ['student'], userIdHeader: 'x-actor' },
          context,
        );
        await custom.canActivate(execution(target));
        expect(context.headers()['x-actor']).toBe('U12345');
      });
    });

    // El guard sirve solo: sin el módulo de observabilidad sigue autenticando.
    it('is optional', async () => {
      const target = request({ authorization: `Bearer ${student}` });

      await expect(guard().canActivate(execution(target))).resolves.toBe(true);
    });
  });

  describe('a real signature check', () => {
    it('replaces reading the token as it came', async () => {
      const verify = jest.fn().mockResolvedValue({
        preferred_username: 'ana',
        realm_access: { roles: ['teacher'] },
      });
      const target = request({ authorization: 'Bearer opaque-token' });

      await guard({ verify }).canActivate(execution(target));

      expect(verify).toHaveBeenCalledWith('opaque-token');
      expect(target.user?.id).toBe('ANA');
    });

    // Firma, expiración o emisor: para el llamador todas son lo mismo, y decir
    // cuál falló le regala información a quien esté probando tokens.
    it('turns any failure into a plain 401', async () => {
      const verify = jest.fn().mockRejectedValue(new Error('token expired'));
      const target = request({ authorization: 'Bearer opaque-token' });

      await expect(
        guard({ verify }).canActivate(execution(target)),
      ).rejects.toThrow(UnauthorizedException);
    });
  });
});
