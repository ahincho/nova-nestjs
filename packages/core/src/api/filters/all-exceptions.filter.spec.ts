import {
  BadRequestException,
  ConflictException,
  HttpException,
  HttpStatus,
  Logger,
  NotFoundException,
  type ArgumentsHost,
} from '@nestjs/common';
import { errorItem } from '../../api-standard';
import { ValidationException } from '../exceptions/validation.exception';
import { DEFAULT_API_STANDARD_OPTIONS } from '../tokens';
import { AllExceptionsFilter } from './all-exceptions.filter';

type Captured = {
  status: number | undefined;
  body: unknown;
};

function hostDouble(
  captured: Captured,
  type: 'http' | 'rpc' = 'http',
): ArgumentsHost {
  const response = {
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
  let errorLog: jest.SpyInstance;
  let warnLog: jest.SpyInstance;

  beforeEach(() => {
    filter = new AllExceptionsFilter(DEFAULT_API_STANDARD_OPTIONS);
    captured = { status: undefined, body: undefined };
    errorLog = jest.spyOn(Logger.prototype, 'error').mockImplementation();
    warnLog = jest.spyOn(Logger.prototype, 'warn').mockImplementation();
  });

  afterEach(() => {
    jest.restoreAllMocks();
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
    filter.catch(new Error('boom'), hostDouble(captured, 'rpc'));

    expect(captured.status).toBeUndefined();
    expect(errorLog).toHaveBeenCalledTimes(1);
  });
});
