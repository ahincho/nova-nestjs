import { Module, type DynamicModule } from '@nestjs/common';
import {
  ConfigModule,
  type ConfigFactory,
  type ConfigModuleOptions,
} from '@nestjs/config';

/**
 * El esquema que espera `@nestjs/config`. Se deriva de su propia interfaz en
 * vez de importar `@standard-schema/spec` para no agregar una dependencia por
 * un tipo, y para que siga a la de ellos si la cambian.
 */
type ValidationSchema = NonNullable<ConfigModuleOptions['validationSchema']>;

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
   * Validates the whole environment before anything is constructed. Desde
   * `@nestjs/config` 12 espera un esquema Standard Schema -Zod, Arktype,
   * valibot-, no uno de Joi; la plataforma no depende de ninguno, asi que un
   * servicio elige el suyo. Se puede omitir y validar dentro de cada namespace,
   * o pasar `validate` a `ConfigModule` directamente, que es una funcion y no
   * necesita libreria.
   */
  readonly validationSchema?: ValidationSchema;

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
      // `Array.isArray` sobre un `readonly string[]` estrecha a `any[]`, asi
      // que la rama que parecia la segura era la que metia el `any`. `.flat()`
      // normaliza lo mismo sin perder el tipo.
      envFilePath: options.envFilePath
        ? [options.envFilePath].flat()
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
