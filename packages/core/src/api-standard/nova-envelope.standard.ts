import { errorItem } from './api-error';
import { ApiResponses } from './api-responses';
import type {
  ApiFailure,
  ApiStandard,
  ApiStandardDocs,
  ApiWire,
  OpenApiSchema,
} from './api-standard';
import {
  NOVA_ERROR_CATALOG,
  errorCodeFor,
  type ApiErrorCatalog,
} from './error-code';

/** Nombre del sobre en `components.schemas`. */
export const ENVELOPE_SCHEMA_NAME = 'ApiEnvelopeSchema';

/** Nombre de una entrada de error en `components.schemas`. */
export const ERROR_ITEM_SCHEMA_NAME = 'ApiErrorItemSchema';

export type NovaEnvelopeOptions = {
  /**
   * Códigos que cambian respecto de {@link NOVA_ERROR_CATALOG}. Se suman al
   * catálogo en vez de reemplazarlo: quien quiere nombrar un 502 no tiene que
   * volver a escribir los otros doce.
   *
   * @example
   * new NovaEnvelopeStandard({ codes: { byStatus: { 502: 'BAD_GATEWAY' } } });
   */
  readonly codes?: Partial<ApiErrorCatalog>;
};

function mergeCatalog(
  base: ApiErrorCatalog,
  codes: Partial<ApiErrorCatalog> = {},
): ApiErrorCatalog {
  return {
    validation: codes.validation ?? base.validation,
    byStatus: { ...base.byStatus, ...codes.byStatus },
    request: codes.request ?? base.request,
    internal: codes.internal ?? base.internal,
  };
}

function ref(name: string): OpenApiSchema {
  return { $ref: `#/components/schemas/${name}` };
}

// Los mismos esquemas que `@nestjs/swagger` genera de las clases
// `ApiEnvelopeSchema` y `ApiErrorItemSchema`, escritos a mano para que este
// módulo no dependa de él. Una prueba compara los dos: si se separan, el
// documento cambiaría según quién lo arme.
const COMPONENTS: Readonly<Record<string, OpenApiSchema>> = {
  [ERROR_ITEM_SCHEMA_NAME]: {
    type: 'object',
    properties: {
      code: { type: 'string', example: 'NOT_FOUND' },
      message: { type: 'string', example: 'Course not found' },
      field: { type: 'string', nullable: true, example: null },
    },
    required: ['code', 'message', 'field'],
  },
  [ENVELOPE_SCHEMA_NAME]: {
    type: 'object',
    properties: {
      success: { type: 'boolean', example: true },
      status: { type: 'number', example: 200 },
      data: { type: 'object', nullable: true },
      errors: { type: 'array', items: ref(ERROR_ITEM_SCHEMA_NAME) },
    },
    required: ['success', 'status', 'data', 'errors'],
  },
};

function envelopeDocs(catalog: ApiErrorCatalog): ApiStandardDocs {
  return {
    components: COMPONENTS,

    success: (payload) => ({
      schema: {
        allOf: [
          ref(ENVELOPE_SCHEMA_NAME),
          {
            properties: {
              // Una lista viaja como lista; un objeto puede faltar, y el sobre
              // lo contesta como `data: null`.
              data:
                payload['type'] === 'array'
                  ? payload
                  : { ...payload, nullable: true },
            },
          },
        ],
      },
    }),

    failure: (status) => ({
      description: errorCodeFor(
        catalog,
        status,
        status >= 500 ? 'internal' : 'request',
      ),
      schema: {
        allOf: [
          ref(ENVELOPE_SCHEMA_NAME),
          {
            properties: {
              success: { type: 'boolean', example: false },
              status: { type: 'number', example: status },
              data: { nullable: true, example: null },
            },
          },
        ],
      },
    }),
  };
}

/**
 * El estándar de API de Nova: el sobre `{ success, status, data, errors }`.
 *
 * Es la implementación que se registra cuando nadie declara otra, y la que
 * contesta igual que antes de que el estándar se pudiera reemplazar.
 *
 * El `traceId` no viaja en el cuerpo: va en la cabecera de respuesta. Ponerlo
 * acá es una decisión de ADR-031, no de este estándar.
 *
 * @example
 * NovaModule.forRoot({
 *   apiStandard: {
 *     standard: new NovaEnvelopeStandard({
 *       codes: { byStatus: { 502: 'BAD_GATEWAY' } },
 *     }),
 *   },
 * });
 */
export class NovaEnvelopeStandard implements ApiStandard {
  /** El catálogo con el que nombra los fallos que no traen código propio. */
  readonly catalog: ApiErrorCatalog;

  readonly openapi: ApiStandardDocs;

  constructor(options: NovaEnvelopeOptions = {}) {
    this.catalog = mergeCatalog(NOVA_ERROR_CATALOG, options.codes);
    this.openapi = envelopeDocs(this.catalog);
  }

  success(payload: unknown, status: number): ApiWire {
    return { body: ApiResponses.ok(payload, status) };
  }

  failure(failure: ApiFailure): ApiWire {
    return {
      body: ApiResponses.error(
        failure.status,
        ...failure.errors.map((error) =>
          errorItem(
            error.code ??
              errorCodeFor(this.catalog, failure.status, failure.kind),
            error.message,
            error.field,
          ),
        ),
      ),
    };
  }

  owns(payload: unknown): boolean {
    return ApiResponses.isApiResponse(payload);
  }
}
