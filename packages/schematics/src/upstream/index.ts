import { strings } from '@angular-devkit/core';
import {
  apply,
  applyTemplates,
  mergeWith,
  move,
  url,
  type Rule,
} from '@angular-devkit/schematics';
import { normalizePath, templateVariables } from '../naming';
import type { UpstreamOptions } from './schema';

/**
 * Genera la declaracion completa de un upstream.
 *
 * Es el generador que mas paga: un upstream son cuatro archivos que solo
 * cambian de nombre entre uno y otro, y copiarlos es como se llega a tres
 * versiones distintas del cliente del mismo servicio.
 */
export function upstream(options: UpstreamOptions): Rule {
  const name = strings.dasherize(options.name);
  const target = normalizePath(options.path ?? `src/upstream/${name}`);

  return mergeWith(
    apply(url('./files'), [
      applyTemplates({ ...strings, ...templateVariables(name) }),
      move(target),
    ]),
  );
}

export default upstream;
