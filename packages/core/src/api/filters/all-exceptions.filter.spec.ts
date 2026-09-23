import {
  BadRequestException,
  ConflictException,
  HttpException,
  HttpStatus,
  Logger,
  NotFoundException,
  type ArgumentsHost,
} from '@nestjs/common';
import {
  NovaEnvelopeStandard,
  errorItem,
  type ApiFailure,
  type ApiStandard,
  type ApiWire,
} from '../../api-standard';
import { ValidationException } from '../exceptions/validation.exception';
import { DEFAULT_API_STANDARD_OPTIONS } from '../tokens';
import { AllExceptionsFilter } from './all-exceptions.filter';
import type { MockInstance } from 'vitest';

type Captured = {
  status: number | undefined;
  body: unknown;
  headers?: Record<string, string>;
};

/**
 * Un estándar que anota lo que recibe, para poder mirar qué le entrega el
 * filtro: es la única forma de probar que el núcleo sanea antes y no después.
 */
class RecordingStandard implements ApiStandard {
  readonly received: ApiFailure[] = [];

  readonly openapi = new NovaEnvelopeStandard().openapi;

  success(payload: unknown): ApiWire {
    return { body: payload };
  }

  failure(failure: ApiFailure): ApiWire {
    this.received.push(failure);
    return {
      contentType: 'application/problem+json',
      body: { title: 'problem', status: failure.status },
    };
  }

  owns(): boolean {
    return false;
  }
}

function hostDouble(
  captured: Captured,
  type: 'http' | 'rpc' = 'http',
): ArgumentsHost {
  const response = {
    setHeader(name: string, value: string) {
      captured.headers = { ...captured.headers, [name]: value };
    },
    status(code: number) {
      captured.status = code;
      return {
        json(body: unknown) {
          captured.body = body;
          return body;
        },
      };
    },
  };

  return {
    getType: () => type,
    switchToHttp: () => ({
      getResponse: () => response,
      getRequest: () => ({
        id: 'req-1',
        url: '/v1/students/7',
        method: 'GET',
      }),
    }),
  } as unknown as ArgumentsHost;
}

describe('AllExceptionsFilter', () => {
  let filter: AllExceptionsFilter;
  let captured: Captured;
  let errorLog: MockInstance;
  let warnLog: MockInstance;

  beforeEach(() => {
    filter = new AllExceptionsFilter(DEFAULT_API_STANDARD_OPTIONS);
    captured = { status: undefined, body: undefined };
    errorLog = vi.spyOn(Logger.prototype, 'error').mockImplementation(() => {});
    warnLog = vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('answers a 404 with the envelope and the derived code', () => {
    filter.catch(
      new NotFoundException('Student not found'),
      hostDouble(captured),
    );

    expect(captured.status).toBe(404);
    expect(captured.body).toEqual({
      success: false,
      status: 404,
      data: null,
      errors: [
        { code: 'NOT_FOUND', message: 'Student not found', field: null },
      ],
    });
  });

  // El codigo del envelope sale del status salvo que la excepcion traiga uno,
  // que es lo que NestJS 12 agrego para no tener que escribir una excepcion
  // propia por cada codigo de dominio.
  it('prefers the errorCode of the exception over the one from the status', () => {
    filter.catch(
      new NotFoundException('Course not found', {
        errorCode: 'COURSE_NOT_FOUND',
      }),
      hostDouble(captured),
    );

    expect(captured.status).toBe(404);
    expect(captured.body).toMatchObject({
      errors: [
        {
          code: 'COURSE_NOT_FOUND',
          message: 'Course not found',
          field: null,
        },
      ],
    });
  });

  // Un 5xx contesta el mensaje generico a proposito, y dejar pasar un codigo
  // de dominio ahi cuenta que fallo por dentro.
  it('ignores the errorCode of a 5xx', () => {
    filter.catch(
      new HttpException('Upstream exploded', HttpStatus.BAD_GATEWAY, {
        errorCode: 'ACADEMIC_UPSTREAM_DOWN',
      }),
      hostDouble(captured),
    );

    expect(captured.status).toBe(502);
    expect(captured.body).toMatchObject({
      errors: [{ code: 'INTERNAL_SERVER_ERROR' }],
    });
  });

  it('keeps the field-level entries of a ValidationException', () => {
    const errors = [
      errorItem('VALIDATION_ERROR', 'must be an integer', 'periodId'),
    ];

    filter.catch(new ValidationException(errors), hostDouble(captured));

    expect(captured.status).toBe(400);
    expect(captured.body).toMatchObject({ errors });
  });

  it('joins the array of messages NestJS builds for a 400', () => {
    filter.catch(
      new BadRequestException(['first problem', 'second problem']),
      hostDouble(captured),
    );

    expect(captured.body).toMatchObject({
      errors: [
        {
          code: 'BAD_REQUEST',
          message: 'first problem, second problem',
          field: null,
        },
      ],
    });
  });

  // The message of the original failure names tables, hosts and libraries. It
  // belongs in the log, never in the body.
  it('never leaks the message of an unknown failure', () => {
    filter.catch(
      new Error('connect ECONNREFUSED 10.0.3.14:5432'),
      hostDouble(captured),
    );

    expect(captured.status).toBe(HttpStatus.INTERNAL_SERVER_ERROR);
    expect(captured.body).toEqual({
      success: false,
      status: 500,
      data: null,
      errors: [
        {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Internal server error',
          field: null,
        },
      ],
    });
    expect(JSON.stringify(captured.body)).not.toContain('ECONNREFUSED');
  });

  // Same rule for a 5xx raised deliberately: a 502 tells the caller our
  // topology has an upstream behind it.
  it('collapses an explicit 502 to the generic entry', () => {
    filter.catch(
      new HttpException('Upstream schedules service is down', 502),
      hostDouble(captured),
    );

    expect(captured.body).toMatchObject({
      status: 502,
      errors: [
        {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Internal server error',
          field: null,
        },
      ],
    });
  });

  it('reports the configured internal message', () => {
    const custom = new AllExceptionsFilter({
      ...DEFAULT_API_STANDARD_OPTIONS,
      internalErrorMessage: 'Error interno del servidor',
    });

    custom.catch(new Error('boom'), hostDouble(captured));

    expect(captured.body).toMatchObject({
      errors: [
        expect.objectContaining({ message: 'Error interno del servidor' }),
      ],
    });
  });

  // A 4xx logged at error level is what buries the 5xx that need attention.
  it('logs a 4xx as a warning and a 5xx as an error', () => {
    filter.catch(
      new ConflictException('Already enrolled'),
      hostDouble(captured),
    );
    expect(warnLog).toHaveBeenCalledTimes(1);
    expect(errorLog).not.toHaveBeenCalled();

    filter.catch(new Error('boom'), hostDouble(captured));
    expect(errorLog).toHaveBeenCalledTimes(1);
  });

  it('reports instead of answering when there is no HTTP context', () => {
    const boom = new Error('boom');

    filter.catch(boom, hostDouble(captured, 'rpc'));

    expect(captured.status).toBeUndefined();
    expect(errorLog).toHaveBeenCalledWith(
      { err: boom },
      'Unhandled exception outside an HTTP context',
    );
  });

  // Con la forma del ConsoleLogger, `error(campos, stack)`, pino toma el
  // segundo argumento como mensaje: cada línea era distinta y agrupar por
  // mensaje dejaba de servir justo para los errores.
  describe('the message and the stack of the log line', () => {
    it('keeps the stack out of the message, in err', () => {
      const boom = new Error('boom');

      filter.catch(boom, hostDouble(captured));

      expect(errorLog).toHaveBeenCalledWith(
        expect.objectContaining({ err: boom }),
        'boom',
      );
      const [, message] = errorLog.mock.calls[0] as [unknown, string];
      expect(message).not.toContain('\n');
    });

    it('logs a 4xx with its message and without a stack', () => {
      filter.catch(
        new NotFoundException('Student not found'),
        hostDouble(captured),
      );

      expect(warnLog).toHaveBeenCalledWith(
        expect.not.objectContaining({ err: expect.anything() }),
        'Student not found',
      );
    });

    it('names a thrown value that is not an Error', () => {
      filter.catch('boom', hostDouble(captured));
      filter.catch({ reason: 'boom' }, hostDouble(captured));

      expect(errorLog).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({ err: 'boom' }),
        'boom',
      );
      expect(errorLog).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({ err: { reason: 'boom' } }),
        'Unhandled exception',
      );
    });
  });

  // Los nombres de estos campos son un contrato con el índice de logs, no una
  // preferencia: las consultas y los tableros que ya existen están escritos
  // sobre `traceId` y `statusCode`. Llamarlos de otra forma deja las líneas
  // dentro del índice y fuera de toda búsqueda, que es peor que no loguearlas.
  //
  // `traceId` es además el mismo valor que pino-http publica como `req.id`, así
  // que una búsqueda por el UUID trae la línea de la petición y la del error.
  it('logs the fields the log index is queried by', () => {
    filter.catch(
      new ConflictException('Already enrolled'),
      hostDouble(captured),
    );

    expect(warnLog).toHaveBeenCalledWith(
      expect.objectContaining({
        traceId: 'req-1',
        statusCode: 409,
        method: 'GET',
        path: '/v1/students/7',
      }),
      'Already enrolled',
    );
  });

  // Una excepción puede traer campos para su línea de log. El cliente HTTP los
  // usa para la clasificación del fallo de upstream, y el filtro los lee por su
  // forma, sin importar el módulo que la lanzó.
  describe('the fields an exception brings for its log', () => {
    function withLogFields(logFields: unknown): HttpException {
      return Object.assign(
        new HttpException('Upstream service error', HttpStatus.BAD_GATEWAY),
        { logFields },
      );
    }

    it('adds them to the log line', () => {
      filter.catch(
        withLogFields({ upstream: { category: 'connectivity' } }),
        hostDouble(captured),
      );

      expect(errorLog).toHaveBeenCalledWith(
        expect.objectContaining({
          upstream: { category: 'connectivity' },
          statusCode: 502,
          traceId: 'req-1',
        }),
        expect.anything(),
      );
    });

    // Los campos del índice son un contrato; ninguna excepción los pisa.
    it('never lets them overwrite the fields the index is queried by', () => {
      filter.catch(
        withLogFields({ traceId: 'forged', statusCode: 200 }),
        hostDouble(captured),
      );

      expect(errorLog).toHaveBeenCalledWith(
        expect.objectContaining({ traceId: 'req-1', statusCode: 502 }),
        expect.anything(),
      );
    });

    it('keeps them out of the response body', () => {
      filter.catch(
        withLogFields({ upstream: { upstream: 'academic.internal' } }),
        hostDouble(captured),
      );

      expect(JSON.stringify(captured.body)).not.toContain('academic.internal');
    });

    it('ignores a logFields that is not an object', () => {
      filter.catch(withLogFields('not an object'), hostDouble(captured));

      expect(errorLog).toHaveBeenCalledWith(
        expect.not.objectContaining({ 0: 'n' }),
        expect.anything(),
      );
    });
  });

  // Con otro estándar la respuesta cambia de forma, pero lo que el filtro le
  // entrega sigue pasando por las mismas reglas. Estas pruebas miran esa
  // entrega y no el cuerpo, porque el cuerpo ya no es de la plataforma.
  describe('with another standard', () => {
    let standard: RecordingStandard;

    beforeEach(() => {
      standard = new RecordingStandard();
      filter = new AllExceptionsFilter(DEFAULT_API_STANDARD_OPTIONS, standard);
    });

    it('answers with the body and the content type of the standard', () => {
      filter.catch(
        new NotFoundException('Student not found'),
        hostDouble(captured),
      );

      expect(captured.status).toBe(404);
      expect(captured.body).toEqual({ title: 'problem', status: 404 });
      expect(captured.headers).toEqual({
        'Content-Type': 'application/problem+json',
      });
    });

    // La regla que ningún estándar puede tocar: lo que el estándar recibe ya
    // viene saneado, así que no tiene de dónde sacar el mensaje original.
    it('hands over an unknown failure already sanitised', () => {
      filter.catch(
        new Error('connect ECONNREFUSED 10.0.3.14:5432'),
        hostDouble(captured),
      );

      expect(standard.received).toEqual([
        {
          status: 500,
          kind: 'internal',
          traceId: 'req-1',
          errors: [
            { code: undefined, message: 'Internal server error', field: null },
          ],
        },
      ]);
      expect(JSON.stringify(standard.received)).not.toContain('ECONNREFUSED');
    });

    it('drops the domain code of a 5xx before the standard sees it', () => {
      filter.catch(
        new HttpException('Upstream exploded', HttpStatus.BAD_GATEWAY, {
          errorCode: 'ACADEMIC_UPSTREAM_DOWN',
        }),
        hostDouble(captured),
      );

      expect(standard.received[0]).toMatchObject({
        status: 502,
        kind: 'internal',
        errors: [{ code: undefined, message: 'Internal server error' }],
      });
      expect(JSON.stringify(standard.received)).not.toContain('exploded');
    });

    it('passes the code of the thrower below 500', () => {
      filter.catch(
        new NotFoundException('Course not found', {
          errorCode: 'COURSE_NOT_FOUND',
        }),
        hostDouble(captured),
      );

      expect(standard.received[0]).toMatchObject({
        kind: 'request',
        errors: [{ code: 'COURSE_NOT_FOUND', message: 'Course not found' }],
      });
    });

    // Sin código: cómo se llama un fallo de validación lo decide el catálogo
    // del estándar, no el núcleo.
    it('passes the violations of the input with no code of their own', () => {
      filter.catch(
        new ValidationException([
          { field: 'periodId', message: 'must be an integer' },
        ]),
        hostDouble(captured),
      );

      expect(standard.received[0]).toEqual({
        status: 400,
        kind: 'validation',
        traceId: 'req-1',
        errors: [
          { code: undefined, message: 'must be an integer', field: 'periodId' },
        ],
      });
    });

    // La línea de log es de observabilidad: cambiar la forma de la respuesta
    // no puede cambiar lo que buscan las consultas.
    it('keeps the log line in the names of the Nova catalog', () => {
      filter.catch(
        new ConflictException('Already enrolled'),
        hostDouble(captured),
      );

      expect(warnLog).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 409,
          errors: [
            { code: 'CONFLICT', message: 'Already enrolled', field: null },
          ],
        }),
        'Already enrolled',
      );
    });
  });
});
