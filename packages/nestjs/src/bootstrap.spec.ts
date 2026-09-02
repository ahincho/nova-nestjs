import { ValidationPipe, type INestApplication } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { bootstrap } from './bootstrap';

type AppDouble = {
  useLogger: jest.Mock;
  useGlobalPipes: jest.Mock;
  setGlobalPrefix: jest.Mock;
  enableCors: jest.Mock;
  listen: jest.Mock;
};

describe('bootstrap', () => {
  let app: AppDouble;

  beforeEach(() => {
    app = {
      useLogger: jest.fn(),
      useGlobalPipes: jest.fn(),
      setGlobalPrefix: jest.fn(),
      enableCors: jest.fn(),
      listen: jest.fn().mockResolvedValue(undefined),
    };

    jest
      .spyOn(NestFactory, 'create')
      .mockResolvedValue(app as unknown as INestApplication);
    delete process.env['PORT'];
  });

  afterEach(() => {
    jest.restoreAllMocks();
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

  it('installs a logger when one is given', async () => {
    const logger = { log: jest.fn(), error: jest.fn(), warn: jest.fn() };

    await bootstrap(AppModule, { logger });

    expect(app.useLogger).toHaveBeenCalledWith(logger);
  });

  it('buffers the logs until the logger is installed', async () => {
    await bootstrap(AppModule);

    expect(NestFactory.create).toHaveBeenCalledWith(AppModule, {
      bufferLogs: true,
    });
  });
});
