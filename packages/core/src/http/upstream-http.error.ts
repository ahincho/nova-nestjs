/**
 * The upstream answered, and it answered with a failure.
 *
 * Only raised when the call site asked for it with `forwardError: true`. By
 * default an upstream failure is translated into a 502 or a 504 before it can
 * reach the client, because the upstream's own status describes a topology the
 * caller should not learn about.
 */
export class UpstreamHttpError extends Error {
  constructor(
    readonly statusCode: number,
    readonly body: unknown,
    readonly headers: Record<string, string>,
  ) {
    super(`Upstream responded ${statusCode}`);
    this.name = 'UpstreamHttpError';
  }
}
