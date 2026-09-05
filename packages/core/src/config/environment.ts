/**
 * Raised when an environment variable is missing or unusable.
 *
 * Thrown while the module graph is being built, so the container dies at boot
 * instead of at the first request that needed the value.
 */
export class EnvironmentError extends Error {
  constructor(
    readonly variable: string,
    reason: string,
  ) {
    super(`Environment variable ${variable} ${reason}`);
    this.name = 'EnvironmentError';
  }
}

function read(name: string): string | undefined {
  const value = process.env[name];
  // An empty string is what a task definition produces when the value was left
  // blank, and it is never a legitimate configuration. Treating it as missing
  // is what makes the failure say which variable to fix.
  return value === undefined || value.trim() === '' ? undefined : value.trim();
}

/**
 * Reads a variable that has to be there.
 *
 * @throws {EnvironmentError} when it is missing or blank.
 */
export function requireEnv(name: string): string {
  const value = read(name);

  if (value === undefined) {
    throw new EnvironmentError(name, 'is required but was not set');
  }

  return value;
}

/**
 * Reads a variable, falling back when it is missing or blank.
 */
export function optionalEnv(name: string, fallback: string): string {
  return read(name) ?? fallback;
}

/**
 * Reads a numeric variable.
 *
 * @throws {EnvironmentError} when it is not a finite number, or when it is
 * missing and no fallback was given.
 */
export function numberEnv(name: string, fallback?: number): number {
  const value = read(name);

  if (value === undefined) {
    if (fallback === undefined) {
      throw new EnvironmentError(name, 'is required but was not set');
    }
    return fallback;
  }

  const parsed = Number(value);

  // `Number('')` is 0 and `Number('8080abc')` is NaN. Reporting the offending
  // text is what turns a silent zero timeout into a readable boot failure.
  if (!Number.isFinite(parsed)) {
    throw new EnvironmentError(name, `must be a number, but was "${value}"`);
  }

  return parsed;
}

const TRUTHY = new Set(['true', '1', 'yes']);
const FALSY = new Set(['false', '0', 'no']);

/**
 * Reads a boolean variable, accepting `true/false`, `1/0` and `yes/no`.
 *
 * @throws {EnvironmentError} when the value is none of those, or when it is
 * missing and no fallback was given.
 */
export function booleanEnv(name: string, fallback?: boolean): boolean {
  const value = read(name)?.toLowerCase();

  if (value === undefined) {
    if (fallback === undefined) {
      throw new EnvironmentError(name, 'is required but was not set');
    }
    return fallback;
  }

  if (TRUTHY.has(value)) {
    return true;
  }

  if (FALSY.has(value)) {
    return false;
  }

  throw new EnvironmentError(
    name,
    `must be a boolean (true/false, 1/0, yes/no), but was "${value}"`,
  );
}

/**
 * Reads an absolute HTTP(S) URL and strips a trailing slash.
 *
 * The two checks exist because both failures survive a deploy and only show up
 * at the first call: a value without a scheme is not a URL a client can use,
 * and a trailing slash turns every `${base}/path` into a double slash that some
 * gateways route to a different rule than the one that was tested.
 *
 * @throws {EnvironmentError} when it is missing, unparseable or not HTTP(S).
 */
export function urlEnv(name: string): string {
  const value = requireEnv(name);

  let parsed: URL | undefined;
  try {
    parsed = new URL(value);
  } catch {
    parsed = undefined;
  }

  // Both branches report the same thing on purpose. `academic.internal:8080`
  // parses as a URL whose protocol is `academic.internal:`, so splitting the
  // message would answer "wrong scheme" to what is really a missing one.
  if (
    parsed === undefined ||
    (parsed.protocol !== 'http:' && parsed.protocol !== 'https:')
  ) {
    throw new EnvironmentError(
      name,
      `must be an absolute http(s) URL, but was "${value}"`,
    );
  }

  return value.replace(/\/+$/, '');
}
