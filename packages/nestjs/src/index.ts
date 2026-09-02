export { bootstrap, type BootstrapOptions } from './bootstrap';
export { NovaModule, type NovaModuleOptions } from './nova.module';

// Re-exported so an application imports the platform from one place rather than
// from six, the way spring-boot-starter puts what an application needs behind a
// single dependency.
export {
  ApiResponses,
  errorItem,
  statusToErrorCode,
  type ApiErrorItem,
  type ApiResponse,
} from '@nova-platform/api-standard';
export {
  SkipResponseWrapper,
  ValidationException,
  validationExceptionFactory,
} from '@nova-platform/nestjs-api-standard';
export {
  buildCorsOptions,
  defineUpstream,
  booleanEnv,
  numberEnv,
  optionalEnv,
  requireEnv,
  urlEnv,
  EnvironmentError,
  type UpstreamConfig,
} from '@nova-platform/nestjs-config';
export { type ReadinessCheck } from '@nova-platform/nestjs-health';
export {
  HttpClientService,
  UpstreamHttpError,
  type HttpRequestOptions,
} from '@nova-platform/nestjs-http';
export {
  RequestContextService,
  SENSITIVE_HEADERS,
  createRequestLoggerOptions,
  type RequestContext,
} from '@nova-platform/nestjs-observability';
