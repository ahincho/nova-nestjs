import { Module, type DynamicModule } from '@nestjs/common';
import { ConfigModule, type ConfigFactory } from '@nestjs/config';

export type NovaConfigModuleOptions = {
  /**
   * Configuration namespaces to load, typically the upstreams declared with
   * `defineUpstream()`.
   */
  readonly load?: readonly ConfigFactory[];

  /**
   * Files to read variables from, in order. Defaults to `.env`, and is ignored
   * in a container where the variables come from the task definition.
   */
  readonly envFilePath?: string | readonly string[];

  /**
   * Validates the whole environment before anything is constructed. Accepts a
   * Joi schema, which is what `@nestjs/config` expects; the platform does not
   * depend on Joi, so an application that prefers another validator can leave
   * this out and validate inside its own namespaces.
   */
  readonly validationSchema?: unknown;

  /** Set to false to keep the configuration out of the global scope. */
  readonly isGlobal?: boolean;
};

/**
 * Loads and validates the configuration of a Nova service.
 *
 * A thin wrapper over `ConfigModule.forRoot()` that fixes the two settings
 * every service was setting the same way anyway, so they cannot drift: the
 * module is global, and `${VAR}` references inside values are expanded.
 *
 * It is async because `ConfigModule.forRoot()` is - reading the env files is
 * I/O. Nest accepts a promise in `imports`, so the call site does not change.
 *
 * @example
 * @Module({
 *   imports: [NovaConfigModule.forRoot({ load: [academicOrchestrator] })],
 * })
 * export class AppModule {}
 */
@Module({})
export class NovaConfigModule {
  static async forRoot(
    options: NovaConfigModuleOptions = {},
  ): Promise<DynamicModule> {
    const isGlobal = options.isGlobal ?? true;

    const configModule = await ConfigModule.forRoot({
      isGlobal,
      // A secret injected as one JSON blob is read by expanding it into the
      // variables that reference it, which only happens with this on.
      expandVariables: true,
      load: options.load ? [...options.load] : [],
      envFilePath: options.envFilePath
        ? [
            ...(Array.isArray(options.envFilePath)
              ? options.envFilePath
              : [options.envFilePath as string]),
          ]
        : undefined,
      validationSchema: options.validationSchema,
    });

    return {
      module: NovaConfigModule,
      global: isGlobal,
      imports: [configModule],
      exports: [configModule],
    };
  }
}
