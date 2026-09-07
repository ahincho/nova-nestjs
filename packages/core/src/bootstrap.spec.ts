import { ValidationPipe, type INestApplication } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { bootstrap } from './bootstrap';
import { setupOpenApi } from './openapi';
import type { Mock } from 'vitest';

// El montaje se sustituye porque necesita una aplicación de verdad para
// recorrer los controladores, y acá el doble es un objeto plano. Lo que se
// prueba en este archivo es *cuándo* se llama; el qué monta lo prueban los
// tests de `openapi/`.
vi.mock('./openapi', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./openapi')>()),
  setupOpenApi: vi.fn(),
}));

type AppDouble = {
  useLogger: Mock;
  useGlobalPipes: Mock;
  setGlobalPrefix: Mock;
  enableCors: Mock;
  enableShutdownHooks: Mock;
  listen: Mock;
};

describe('bootstrap', () => {
  let app: AppDouble;

  beforeEach(() => {
    app = {
      useLogger: vi.fn(),
      useGlobalPipes: vi.fn(),
      setGlobalPrefix: vi.fn(),
      enableCors: vi.fn(),
      enableShutdownHooks: vi.fn(),
      listen: vi.fn().mockResolvedValue(undefined),
    };

    vi.spyOn(NestFactory, 'create').mockResolvedValue(
      app as unknown as INestApplication,
    );
    delete process.env['PORT'];
  });

  afterEach(() => {
    vi.restoreAllMocks();
    delete process.env['PORT'];
  });

  class AppModule {}

  // Binding to localhost inside a container makes the service unreachable from
  // the load balancer while looking perfectly healthy from a local shell.
  it('binds every interface on port 3000 by default', async () => {
    await bootstrap(AppModule);

    expect(app.listen).toHaveBeenCalledWith(3000, '0.0.0.0');
  });

  it('reads the port from the environment', async () => {
    process.env['PORT'] = '8080';

    await bootstrap(AppModule);

    expect(app.listen).toHaveBeenCalledWith(8080, '0.0.0.0');
  });

  it('lets the caller pass the port and host explicitly', async () => {
    await bootstrap(AppModule, { port: 4000, host: '127.0.0.1' });

    expect(app.listen).toHaveBeenCalledWith(4000, '127.0.0.1');
  });

  it('installs the validation pipe with the envelope factory', async () => {
    await bootstrap(AppModule);

    const pipe = app.useGlobalPipes.mock.calls[0]?.[0] as ValidationPipe;
    expect(pipe).toBeInstanceOf(ValidationPipe);
  });

  it('leaves CORS off unless a policy is given', async () => {
    await bootstrap(AppModule);
    expect(app.enableCors).not.toHaveBeenCalled();

    await bootstrap(AppModule, {
      cors: { origins: 'https://nova.example.edu' },
    });
    expect(app.enableCors).toHaveBeenCalledWith(
      expect.objectContaining({ origin: ['https://nova.example.edu'] }),
    );
  });

  it('adds no global prefix unless asked', async () => {
    await bootstrap(AppModule);

    expect(app.setGlobalPrefix).not.toHaveBeenCalled();
  });

  // A prefix that quietly moves /health/live to /api/health/live makes the task
  // deregister seconds after it registers, and the deploy dies ten minutes
  // later on a timeout that reads like a resource problem.
  it('keeps the probes out of the global prefix', async () => {
    await bootstrap(AppModule, { globalPrefix: 'api' });

    expect(app.setGlobalPrefix).toHaveBeenCalledWith('api', {
      exclude: ['health/live', 'health/ready'],
    });
  });

  it('excludes the probes under a custom health path', async () => {
    await bootstrap(AppModule, { globalPrefix: 'api', healthPath: 'status' });

    expect(app.setGlobalPrefix).toHaveBeenCalledWith('api', {
      exclude: ['status/live', 'status/ready'],
    });
  });

  it('keeps the legacy health route out of the global prefix', async () => {
    await bootstrap(AppModule, {
      globalPrefix: 'api',
      legacyHealthPath: 'api/v1/health',
    });

    expect(app.setGlobalPrefix).toHaveBeenCalledWith('api', {
      exclude: ['health/live', 'health/ready', 'api/v1/health'],
    });
  });

  // Without the hooks SIGTERM kills the process before any module hears about
  // it, and the graceful window of the readiness probe never opens.
  it('enables the shutdown hooks', async () => {
    await bootstrap(AppModule);

    expect(app.enableShutdownHooks).toHaveBeenCalled();
  });

  it('installs a logger when one is given', async () => {
    const logger = { log: vi.fn(), error: vi.fn(), warn: vi.fn() };

    await bootstrap(AppModule, { logger });

    expect(app.useLogger).toHaveBeenCalledWith(logger);
  });

  it('buffers the logs until the logger is installed', async () => {
    await bootstrap(AppModule);

    expect(NestFactory.create).toHaveBeenCalledWith(
      AppModule,
      expect.objectContaining({ bufferLogs: true }),
    );
  });

  // A duplicate route is always a bug: one of the two handlers is dead code
  // and which one wins depends on registration order. A shadowed route is
  // sometimes deliberate, so it only warns.
  it('fails on a duplicate route and warns on a shadowed one', async () => {
    await bootstrap(AppModule);

    expect(NestFactory.create).toHaveBeenCalledWith(
      AppModule,
      expect.objectContaining({
        routeConflictPolicy: { duplicate: 'error', shadow: 'warn' },
      }),
    );
  });

  it('lets the caller relax the route conflict policy', async () => {
    await bootstrap(AppModule, { routeConflicts: { duplicate: 'warn' } });

    expect(NestFactory.create).toHaveBeenCalledWith(
      AppModule,
      expect.objectContaining({
        routeConflictPolicy: { duplicate: 'warn' },
      }),
    );
  });

  // The half of the graceful shutdown the hooks do not cover: while the app is
  // closing, a new request has to be turned away with a 503 so the load
  // balancer takes the task out of rotation, and the in-flight ones finish.
  describe('the OpenAPI document', () => {
    beforeEach(() => {
      vi.mocked(setupOpenApi).mockClear();
    });

    // Igual que CORS y que auth: exponer la documentación es una decisión de
    // quien despliega, no un default de la plataforma.
    it('is not published unless asked', async () => {
      await bootstrap(AppModule);

      expect(setupOpenApi).not.toHaveBeenCalled();
    });

    it('is published when the options are given', async () => {
      await bootstrap(AppModule, { openapi: { title: 'Academic ACL' } });

      expect(setupOpenApi).toHaveBeenCalledWith(app, {
        title: 'Academic ACL',
      });
    });

    // `enabled` existe para decidirlo por ambiente sin sacar el bloque, que es
    // lo que deja el título y los tags escritos donde se leen.
    it('can be switched off without removing the options', async () => {
      await bootstrap(AppModule, {
        openapi: { title: 'Academic ACL', enabled: false },
      });

      expect(setupOpenApi).not.toHaveBeenCalled();
    });
  });

  it('answers 503 to new requests while closing', async () => {
    await bootstrap(AppModule);

    expect(NestFactory.create).toHaveBeenCalledWith(
      AppModule,
      expect.objectContaining({ return503OnClosing: true }),
    );
  });
});
