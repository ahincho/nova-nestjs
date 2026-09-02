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
import type { FeatureOptions, FeatureStyle } from './schema';

export const DEFAULT_STYLE: FeatureStyle = 'acl';

/**
 * Dónde vive un feature en cada layout.
 *
 * Un BFF los agrupa bajo `features/` porque sus adaptadores de salida estan
 * afuera, en `upstream/`, compartidos entre features. Un ACL los pone al primer
 * nivel porque cada uno se lleva los suyos dentro.
 */
export function defaultPathFor(style: FeatureStyle, name: string): string {
  return style === 'bff' ? `src/features/${name}` : `src/${name}`;
}

/**
 * Genera un feature completo en el layout elegido.
 *
 * Los dos son la misma arquitectura hexagonal: el puerto de entrada declara el
 * caso de uso, el servicio lo implementa y el controlador es un adaptador. Lo
 * que cambia es donde queda el adaptador de salida.
 */
export function feature(options: FeatureOptions): Rule {
  const name = strings.dasherize(options.name);
  const style = options.style ?? DEFAULT_STYLE;
  const target = normalizePath(options.path ?? defaultPathFor(style, name));

  return mergeWith(
    apply(url(`./files/${style}`), [
      applyTemplates({ ...strings, ...templateVariables(name) }),
      move(target),
    ]),
  );
}

export default feature;
