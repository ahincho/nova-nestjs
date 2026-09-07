import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { strings } from '@angular-devkit/core';
import {
  apply,
  applyTemplates,
  chain,
  forEach,
  mergeWith,
  move,
  url,
  type FileEntry,
  type Rule,
} from '@angular-devkit/schematics';
import { normalizePath } from '../naming';
import type { ServiceOptions, ServiceStyle } from './schema';

export const DEFAULT_STYLE: ServiceStyle = 'acl';

/** El piso de Node que declara el servicio generado. */
export const NODE_FLOOR = '24.15';

/** El pnpm con el que se genera el lockfile. */
export const PNPM_VERSION = '11.24.0';

/**
 * La versión de la plataforma que el servicio va a pinear.
 *
 * Se lee del propio package.json de este paquete en vez de escribirse a mano,
 * porque los tres se publican con una sola versión: el servicio generado queda
 * pineado exactamente a la release que lo genero, y no a un número que alguien
 * se olvido de subir.
 */
export function platformVersion(): string {
  // Sube desde dist/service/ o src/service/ hasta la raíz del paquete.
  const manifestPath = join(dirname(dirname(__dirname)), 'package.json');
  const parsed: unknown = JSON.parse(readFileSync(manifestPath, 'utf8'));

  if (
    typeof parsed !== 'object' ||
    parsed === null ||
    !('version' in parsed) ||
    typeof parsed.version !== 'string'
  ) {
    throw new Error(`${manifestPath} no declara una version`);
  }

  return parsed.version;
}

/**
 * Normaliza los finales de línea a LF.
 *
 * El motor de plantillas del DevKit devuelve CRLF en Windows aunque la
 * plantilla en disco tenga LF, y entonces `nova format:check` falla en el
 * servicio recien generado: **el generador estaria emitiendo algo que su propia
 * puerta de calidad rechaza**. Normalizar acá además hace que el resultado sea
 * el mismo en cualquier sistema.
 */
const toLineFeed = forEach((entry: FileEntry) => ({
  path: entry.path,
  content: Buffer.from(entry.content.toString('utf8').replaceAll('\r\n', '\n')),
}));

/**
 * Genera un servicio entero, listo para `pnpm install && pnpm verify`.
 *
 * Lo que **no** genera es tan importante como lo que si: no hay `src/common/`
 * ni `src/core/`. El filtro global, el interceptor del sobre, las sondas de
 * salud, el cliente HTTP, la configuración, el contexto de petición y el logger
 * llegan dentro de `@ahincho/nova-nestjs`. En los templates de los que sale
 * está forma, esas dos carpetas eran entre el 40 % y el 50 % de `src`.
 *
 * Se arma en dos pasadas sobre el mismo destino: la base, que es igual para los
 * dos sabores, y encima lo que distingue a uno del otro -hoy, sus reglas de
 * arquitectura-.
 */
export function service(options: ServiceOptions): Rule {
  const name = strings.dasherize(options.name);
  const style = options.style ?? DEFAULT_STYLE;
  const target = normalizePath(options.path ?? name);

  const variables = {
    ...strings,
    name,
    style,
    nodeFloor: NODE_FLOOR,
    pnpmVersion: PNPM_VERSION,
    platformVersion: platformVersion(),
    // Los archivos que empiezan con punto se guardan como `__dot__algo` en las
    // plantillas: un `.gitignore` dentro de un paquete publicado corre riesgo
    // de que npm lo renombre al empaquetar, y el nombre plano lo esquiva.
    dot: '.',
  };

  const from = (source: string): Rule =>
    mergeWith(
      apply(url(source), [applyTemplates(variables), toLineFeed, move(target)]),
    );

  return chain([from('./files/base'), from(`./files/${style}`)]);
}

export default service;
