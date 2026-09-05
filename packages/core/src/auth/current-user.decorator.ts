import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { AuthenticatedRequest } from './auth.guard';
import type { Principal } from './principal';

/**
 * Quién hace la petición, para el controlador.
 *
 * Evita que cada controlador vuelva a leer `req.user` y a decidir qué hacer
 * cuando no está: si el guard dejó pasar la petición, está.
 *
 * @example
 * @Get('me')
 * me(@CurrentUser() user: Principal): Profile {
 *   return this.profiles.of(user.id);
 * }
 */
export const CurrentUser = createParamDecorator(
  (_data: unknown, execution: ExecutionContext): Principal | undefined =>
    execution.switchToHttp().getRequest<AuthenticatedRequest>().user,
);
