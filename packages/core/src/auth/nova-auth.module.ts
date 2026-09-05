import { Module, type DynamicModule } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { NovaAuthGuard } from './auth.guard';
import {
  AUTH_OPTIONS,
  resolveAuthOptions,
  type NovaAuthModuleOptions,
} from './tokens';

/**
 * Autenticación por JWT para todas las rutas del servicio.
 *
 * Es opcional: un servicio interno al que sólo llega tráfico de otro servicio
 * no lo importa, y no paga nada por existir. Cuando se declara, el guard queda
 * global, así que una ruta nueva nace protegida y lo público se escribe con
 * `@Public()`.
 *
 * @example
 * @Module({
 *   imports: [
 *     NovaModule.forRoot({
 *       auth: { preferredRoles: ['student'] },
 *     }),
 *   ],
 * })
 * export class AppModule {}
 */
@Module({})
export class NovaAuthModule {
  static forRoot(options: NovaAuthModuleOptions = {}): DynamicModule {
    return {
      module: NovaAuthModule,
      global: true,
      providers: [
        { provide: AUTH_OPTIONS, useValue: resolveAuthOptions(options) },
        NovaAuthGuard,
        // `useExisting` y no `useClass`: así el guard global y el que alguien
        // inyecte a mano son la misma instancia.
        { provide: APP_GUARD, useExisting: NovaAuthGuard },
      ],
      exports: [AUTH_OPTIONS, NovaAuthGuard],
    };
  }
}
