import { Controller, Get, Module, type INestApplication } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { Logger } from 'nestjs-pino';
import { fetch } from 'undici';
import { DEFAULT_HEALTH_PATH } from '../health';
import { NovaModule } from '../nova.module';

@Controller('courses')
class CoursesController {
  @Get()
  list(): { id: string }[] {
    return [{ id: '1' }];
  }
}

type LogLine = Record<string, unknown> & {
  req?: { id?: string; url?: string };
  res?: { statusCode?: number };
};

const lines: LogLine[] = [];

// pino escribe al descriptor 1 con sonic-boom, así que sustituir
// `process.stdout.write` no intercepta nada: hay que darle un destino.
const destination = {
  write(chunk: string): void {
    for (const line of chunk.split('\n')) {
      if (line.startsWith('{')) {
        lines.push(JSON.parse(line) as LogLine);
      }
    }
  },
};

@Module({
  imports: [NovaModule.forRoot({ observability: { logger: { destination } } })],
  controllers: [CoursesController],
})
class TestModule {}

/**
 * Levanta la aplicación como lo hace `bootstrap()` -- mismo prefijo global,
 * mismas exclusiones, mismo logger -- y devuelve las líneas que pino escribió.
 *
 * Se leen de `process.stdout` en vez de pasarle un destino a pino porque lo que
 * se quiere comprobar es lo que sale del contenedor, que es lo que el
 * recolector termina indexando.
 */
async function boot(): Promise<{ app: INestApplication; base: string }> {
  const app = await NestFactory.create(TestModule, { bufferLogs: true });

  // Igual que `bootstrap()`: mismo prefijo global, mismas exclusiones, mismo
  // logger resuelto del contenedor.
  app.setGlobalPrefix('api/v1', {
    exclude: [`${DEFAULT_HEALTH_PATH}/live`, `${DEFAULT_HEALTH_PATH}/ready`],
  });
  app.useLogger(app.get(Logger));

  // Escucha de verdad en vez de inyectar la petición: lo que se comprueba es el
  // camino completo, middleware incluido, que es donde vive la trampa.
  await app.listen(0, '127.0.0.1');

  return { app, base: await app.getUrl() };
}

describe('request logging', () => {
  let app: INestApplication;
  let base: string;

  async function call(
    path: string,
    headers: Record<string, string> = {},
  ): Promise<number> {
    const response = await fetch(`${base}${path}`, { headers });
    await response.text();
    return response.status;
  }

  beforeEach(async () => {
    lines.length = 0;
    ({ app, base } = await boot());
  });

  afterEach(async () => {
    await app.close();
  });

  function completed(url: string): LogLine | undefined {
    return lines.find((line) => line.req?.url === url);
  }

  it('logs an ordinary request as one JSON document', async () => {
    expect(await call('/api/v1/courses')).toBe(200);

    const line = completed('/api/v1/courses');

    expect(line).toBeDefined();
    expect(line?.res?.statusCode).toBe(200);
    expect(line?.msg).toBe('request completed');
    // El nivel va numérico, que es la forma nativa de pino y por la que están
    // escritos los filtros del índice -- 30 info, 40 warn, 50 error.
    expect(line?.level).toBe(30);
  });

  // La trampa que el propio `LoggerModule` documenta: una ruta excluida del
  // prefijo global se sirve fuera de él, y NestJS sólo devuelve a la lista del
  // middleware las que reconoce como comodín. Una sonda sin log es justo la
  // línea que alguien busca cuando una tarea se desregistra sola.
  it('logs the probes, which are served outside the global prefix', async () => {
    expect(await call('/health/ready')).toBe(200);

    expect(completed('/health/ready')).toBeDefined();
  });

  it('logs the liveness probe too', async () => {
    expect(await call('/health/live')).toBe(200);

    expect(completed('/health/live')).toBeDefined();
  });

  // Un id solo tiene que seguir a la llamada entre servicios; que cada salto
  // invente el suyo rompe la traza en cada frontera.
  it('carries the correlation id the caller sent into the log line', async () => {
    await call('/api/v1/courses', { 'x-request-id': 'req-from-caller' });

    expect(completed('/api/v1/courses')?.req?.id).toBe('req-from-caller');
  });

  // Un índice de logs lo lee más gente que la base de datos que ese token
  // protege, y un token pegado en un buscador es una credencial que funciona.
  it('redacts the authorization header', async () => {
    await call('/api/v1/courses', { authorization: 'Bearer a-live-token' });

    const serialised = JSON.stringify(completed('/api/v1/courses'));

    expect(serialised).not.toContain('a-live-token');
    expect(serialised).toContain('[redacted]');
  });
});
