import { SetMetadata, type CustomDecorator } from '@nestjs/common';

export const IS_PUBLIC = 'nova:public';

/**
 * Deja una ruta fuera del guard de autenticación.
 *
 * El guard protege todo por defecto, que es la única forma de que una ruta
 * nueva no nazca abierta por olvido. Lo público se declara, y queda escrito al
 * lado de la ruta que lo es.
 *
 * Las sondas de salud ya lo traen: si dependieran de un token, el balanceador
 * las vería en 401 y desregistraría una tarea sana.
 *
 * @example
 * @Public()
 * @Get('version')
 * version(): { version: string } {
 *   return { version: '1.0.0' };
 * }
 */
export const Public = (): CustomDecorator => SetMetadata(IS_PUBLIC, true);
