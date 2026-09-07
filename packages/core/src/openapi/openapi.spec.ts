import { Controller, Get, type INestApplication } from '@nestjs/common';
import { SwaggerModule, type OpenAPIObject } from '@nestjs/swagger';
import { Test } from '@nestjs/testing';
import { BEARER_SCHEME, setupOpenApi, type OpenApiOptions } from './openapi';
import type { Mock } from 'vitest';

@Controller('courses')
class CoursesController {
  @Get()
  findAll(): string[] {
    return [];
  }
}

describe('setupOpenApi', () => {
  let app: INestApplication;
  let setup: Mock;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [CoursesController],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();

    setup = vi.fn();
    vi.spyOn(SwaggerModule, 'setup').mockImplementation(setup);
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await app.close();
  });

  /** Corre el montaje y devuelve lo que recibió `SwaggerModule.setup`. */
  function mount(options: Partial<OpenApiOptions> = {}): {
    path: string;
    document: OpenAPIObject;
    options: Record<string, unknown>;
  } {
    setupOpenApi(app, { title: 'Academic ACL', ...options });

    // La última y no la primera: un test puede montar dos veces para comparar
    // el default contra la opción explícita.
    const [path, , document, swaggerOptions] = setup.mock.calls.at(-1) as [
      string,
      unknown,
      OpenAPIObject,
      Record<string, unknown>,
    ];

    return { path, document, options: swaggerOptions };
  }

  it('serves the interface at docs and the document at docs/json', () => {
    const { path, options } = mount();

    expect(path).toBe('docs');
    expect(options['jsonDocumentUrl']).toBe('docs/json');
  });

  it('follows a custom path with the document beside it', () => {
    const { path, options } = mount({ path: 'openapi' });

    expect(path).toBe('openapi');
    expect(options['jsonDocumentUrl']).toBe('openapi/json');
  });

  // El prefijo global versiona la API, no su documentación: si la moviera,
  // cambiar de v1 a v2 rompería el enlace que todo el mundo tiene guardado.
  it('stays out of the global prefix unless asked', () => {
    expect(mount().options['useGlobalPrefix']).toBe(false);
    expect(mount({ useGlobalPrefix: true }).options['useGlobalPrefix']).toBe(
      true,
    );
  });

  it('carries the title, description and version', () => {
    const { document } = mount({
      description: 'Traduce el legado academico',
      version: '2.1.0',
    });

    expect(document.info).toMatchObject({
      title: 'Academic ACL',
      description: 'Traduce el legado academico',
      version: '2.1.0',
    });
  });

  it('defaults the version to 1.0.0', () => {
    expect(mount().document.info.version).toBe('1.0.0');
  });

  // El guard de NovaAuthModule es global, así que la documentación tiene que
  // decir lo mismo: protegido salvo excepción, no abierto salvo anotación.
  it('requires the bearer token on every operation by default', () => {
    const { document } = mount();

    expect(document.components?.securitySchemes).toHaveProperty(BEARER_SCHEME);
    expect(document.security).toEqual([{ [BEARER_SCHEME]: [] }]);
  });

  it('declares no security when the service has no auth', () => {
    const { document } = mount({ bearerAuth: false });

    expect(document.components?.securitySchemes).toBeUndefined();
    expect(document.security).toBeUndefined();
  });

  it('lists the servers and the tags it was given', () => {
    const { document } = mount({
      servers: [{ url: 'https://dev.example.com', description: 'dev' }],
      tags: [{ name: 'courses', description: 'Cursos del alumno' }],
    });

    expect(document.servers).toEqual([
      { url: 'https://dev.example.com', description: 'dev' },
    ]);
    expect(document.tags).toEqual([
      { name: 'courses', description: 'Cursos del alumno' },
    ]);
  });

  // Ningún controlador las alcanza, así que sin declararlas el documento queda
  // con referencias colgadas y la interfaz las muestra vacías.
  it('declares the envelope schemas no controller reaches', () => {
    const { document } = mount();

    expect(document.components?.schemas).toHaveProperty('ApiEnvelopeSchema');
    expect(document.components?.schemas).toHaveProperty('ApiErrorItemSchema');
  });
});
