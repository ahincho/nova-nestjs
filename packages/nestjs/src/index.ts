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
} from '@ahincho/nova-api-standard';
export {
  SkipResponseWrapper,
  ValidationException,
  validationExceptionFactory,
} from '@ahincho/nova-nestjs-api-standard';
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
} from '@ahincho/nova-nestjs-config';
export { type ReadinessCheck } from '@ahincho/nova-nestjs-health';
export {
  HttpClientService,
  UpstreamHttpError,
  type HttpRequestOptions,
} from '@ahincho/nova-nestjs-http';
export {
  RequestContextService,
  SENSITIVE_HEADERS,
  createRequestLoggerOptions,
  type RequestContext,
} from '@ahincho/nova-nestjs-observability';
