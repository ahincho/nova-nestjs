import type { CallHandler, ExecutionContext } from '@nestjs/common';
import type { Reflector } from '@nestjs/core';
import { ApiResponses } from '../../api-standard';
import { lastValueFrom, of } from 'rxjs';
import { ResponseWrapperInterceptor } from './response-wrapper.interceptor';

type ContextOptions = {
  statusCode?: number;
  type?: 'http' | 'rpc';
};

function contextDouble({
  statusCode = 200,
  type = 'http',
}: ContextOptions = {}): ExecutionContext {
  return {
    getType: () => type,
    getHandler: () => () => undefined,
    getClass: () => class Controller {},
    switchToHttp: () => ({ getResponse: () => ({ statusCode }) }),
  } as unknown as ExecutionContext;
}

function handlerDouble(payload: unknown): CallHandler<unknown> {
  return { handle: () => of(payload) };
}

function reflectorDouble(skip?: boolean): Reflector {
  return {
    getAllAndOverride: jest.fn().mockReturnValue(skip),
  } as unknown as Reflector;
}

describe('ResponseWrapperInterceptor', () => {
  it('wraps a plain payload, reading the status off the response', async () => {
    const interceptor = new ResponseWrapperInterceptor(reflectorDouble());

    const result = await lastValueFrom(
      interceptor.intercept(
        contextDouble({ statusCode: 201 }),
        handlerDouble({ id: 7 }),
      ),
    );

    expect(result).toEqual({
      success: true,
      status: 201,
      data: { id: 7 },
      errors: [],
    });
  });

  it('wraps an undefined payload rather than dropping it', async () => {
    const interceptor = new ResponseWrapperInterceptor(reflectorDouble());

    const result = await lastValueFrom(
      interceptor.intercept(contextDouble(), handlerDouble(undefined)),
    );

    expect(ApiResponses.isApiResponse(result)).toBe(true);
  });

  // Wrapping twice produces { data: { data: ... } }, which no client reads.
  it('leaves an envelope the handler already built untouched', async () => {
    const envelope = ApiResponses.errorOf(404, 'Student not found');
    const interceptor = new ResponseWrapperInterceptor(reflectorDouble());

    const result = await lastValueFrom(
      interceptor.intercept(contextDouble(), handlerDouble(envelope)),
    );

    expect(result).toBe(envelope);
  });

  it('passes through when the handler is marked to skip', async () => {
    const payload = { status: 'ok' };
    const interceptor = new ResponseWrapperInterceptor(reflectorDouble(true));

    const result = await lastValueFrom(
      interceptor.intercept(contextDouble(), handlerDouble(payload)),
    );

    expect(result).toBe(payload);
  });

  // A microservice payload is not an HTTP body, and there is no status to read.
  it('passes through outside an HTTP context', async () => {
    const payload = { event: 'student.enrolled' };
    const interceptor = new ResponseWrapperInterceptor(reflectorDouble());

    const result = await lastValueFrom(
      interceptor.intercept(
        contextDouble({ type: 'rpc' }),
        handlerDouble(payload),
      ),
    );

    expect(result).toBe(payload);
  });
});
