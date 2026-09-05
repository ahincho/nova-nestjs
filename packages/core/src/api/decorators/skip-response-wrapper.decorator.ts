import { SetMetadata, type CustomDecorator } from '@nestjs/common';

export const SKIP_RESPONSE_WRAPPER = 'nova:api-standard:skip-response-wrapper';

/**
 * Leaves the decorated handler or controller out of the response envelope.
 *
 * The health probes are the reason this exists. A load balancer checks the body
 * shape, and wrapping it turns `{ status: 'ok' }` into `{ data: { ... } }`. The
 * HTTP status stays 200, so the target group keeps passing and nothing reveals
 * the change until something downstream breaks.
 *
 * Applied to a controller class it covers every route in it.
 */
export const SkipResponseWrapper = (): CustomDecorator =>
  SetMetadata(SKIP_RESPONSE_WRAPPER, true);
