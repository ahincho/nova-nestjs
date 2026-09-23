/**
 * Por qué falló una petición, en los términos que el núcleo puede afirmar.
 *
 * Es lo que el estándar usa para elegir el código de su catálogo, y es todo lo
 * que sabe de la excepción: la excepción misma nunca le llega.
 */
export type ApiFailureKind =
  /** La entrada no pasó la validación: cada error nombra su campo. */
  | 'validation'
  /** Una excepción HTTP por debajo de 500: el llamador pidió algo que no corresponde. */
  | 'request'
  /** Un 5xx, o algo que ni siquiera era una excepción HTTP. */
  | 'internal';

/**
 * Un error dentro de un {@link ApiFailure}.
 */
export type ApiFailureItem = {
  /**
   * El código que puso quien lanzó: el `errorCode` de la excepción o el de una
   * violación. `undefined` cuando no puso ninguno, y siempre en un 5xx, porque
   * el núcleo lo quita: un código de dominio ahí cuenta qué falló por dentro.
   */
  readonly code: string | undefined;

  /** Ya saneado: en un 5xx es el mensaje genérico, nunca el de la excepción. */
  readonly message: string;

  /** El campo que falló, o `null` cuando el error no es de un campo. */
  readonly field: string | null;
};

/**
 * Un fallo ya clasificado y saneado por el núcleo.
 *
 * Es lo único que el estándar recibe para escribir una respuesta de error, y
 * sobre eso se apoya todo el reparto: el estándar decide la forma del cuerpo,
 * pero no tiene de dónde sacar lo que el núcleo le quitó.
 */
export type ApiFailure = {
  readonly status: number;
  readonly kind: ApiFailureKind;

  /** El id de correlación de la petición, cuando lo hay. */
  readonly traceId: string | undefined;

  readonly errors: readonly ApiFailureItem[];
};

/**
 * Lo que sale por el cable.
 */
export type ApiWire = {
  readonly body: unknown;

  /**
   * `Content-Type` de la respuesta. Omitirlo deja el de la plataforma HTTP, que
   * para un objeto es `application/json`. RFC 7807, por ejemplo, contesta sus
   * errores como `application/problem+json`.
   */
  readonly contentType?: string;
};

/**
 * Un esquema de OpenAPI 3, tal como va en el documento.
 *
 * Se declara como objeto abierto para que este módulo no dependa de
 * `@nestjs/swagger`: un estándar se puede escribir y probar sin él.
 */
export type OpenApiSchema = { readonly [key: string]: unknown };

/**
 * Cómo se documenta una respuesta del estándar.
 */
export type ApiStandardDocResponse = {
  readonly schema: OpenApiSchema;

  /** Por defecto `application/json`. */
  readonly contentType?: string;

  /**
   * Lo que el documento muestra al lado del status. Sólo se usa en los fallos,
   * que no traen una descripción propia; la de un éxito la da la operación.
   */
  readonly description?: string;
};

/**
 * La mitad documental del estándar.
 *
 * Existe porque el interceptor transforma la respuesta después de que el
 * controlador la devolvió: un documento que describe el tipo de retorno
 * describe el método, no el cable. Y como el estándar se puede reemplazar, el
 * documento tiene que describir el que está activo, no el de Nova.
 */
export type ApiStandardDocs = {
  /** Esquemas que el estándar agrega a `components.schemas`, por nombre. */
  readonly components: Readonly<Record<string, OpenApiSchema>>;

  /** La respuesta exitosa, con `payload` -el esquema del DTO- adentro. */
  success(payload: OpenApiSchema): ApiStandardDocResponse;

  /** La respuesta de un fallo con este status. */
  failure(status: number): ApiStandardDocResponse;
};

/**
 * El puerto del estándar de API: la forma de todo lo que un servicio contesta
 * por HTTP, tanto lo que devuelve como lo que rechaza de su entrada.
 *
 * Nova registra `NovaEnvelopeStandard` cuando nadie declara otro, y un servicio
 * o un perfil de organización lo reemplaza entero con
 * `NovaModule.forRoot({ apiStandard: { standard } })`.
 *
 * Lo que **no** está acá es deliberado. Qué respuestas pasan por el estándar,
 * qué status corresponde a cada excepción y qué se le puede decir al cliente en
 * un 5xx son reglas del núcleo, y ningún estándar las cambia: el estándar
 * decide la forma, el núcleo decide qué se puede decir (ADR-034).
 */
export interface ApiStandard {
  /** El cuerpo de una respuesta exitosa. */
  success(payload: unknown, status: number): ApiWire;

  /** El cuerpo de una respuesta fallida. */
  failure(failure: ApiFailure): ApiWire;

  /**
   * Si `payload` ya es un cuerpo de este estándar.
   *
   * El interceptor pregunta antes de envolver, para no producir
   * `{ data: { data: ... } }` cuando un handler armó el cuerpo él mismo.
   */
  owns(payload: unknown): boolean;

  readonly openapi: ApiStandardDocs;
}
