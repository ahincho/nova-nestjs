import { format, resolveConfig } from 'prettier';
import type { Rule, Tree } from '@angular-devkit/schematics';

/** Lo que Prettier sabe formatear y este paquete emite. */
const FORMATTABLE = /[.](ts|mjs|cjs|json|md|yaml|yml)$/;

/**
 * La configuración que genera el propio schematic, para no depender de que ya
 * exista un `.prettierrc` en el destino.
 */
const FALLBACK = { singleQuote: true, trailingComma: 'all' as const };

/**
 * Recorre el árbol sin usar `visit`, que en un árbol de plantillas recorre
 * también lo que no se va a escribir.
 */
function files(tree: Tree): string[] {
  const found: string[] = [];

  const walk = (path: string): void => {
    const dir = tree.getDir(path);
    for (const file of dir.subfiles) found.push(`${path}/${file}`);
    for (const sub of dir.subdirs) walk(`${path}/${sub}`);
  };

  walk('');
  return found;
}

/**
 * Formatea con Prettier lo que el generador acaba de emitir.
 *
 * **Una plantilla no puede estar bien formateada para todo nombre posible.**
 * Prettier reenvuelve según el largo de lo renderizado, así que
 * `Symbol('GET_BUILDINGS_USE_CASE')` entra en una línea y
 * `Symbol('GET_ACADEMIC_COURSE_ENROLLMENT_USE_CASE')` no. Ajustar las
 * plantillas a mano funciona para el nombre con el que se probó y se rompe con
 * el siguiente, sin que nada avise hasta que alguien corre `nova verify`.
 *
 * Es la misma decisión que no enumerar contextos en las reglas de arquitectura:
 * lo que depende de un dato variable se calcula, no se escribe.
 *
 * Va dentro de `apply()`, sobre el árbol de plantillas, para que sólo alcance a
 * los archivos que este generador crea y nunca a los que ya estaban.
 */
export function formatted(): Rule {
  return async (tree: Tree) => {
    // La del destino si existe -un feature dentro de un servicio ya la tiene-,
    // y si no la que el propio schematic acaba de emitir.
    const config = (await resolveConfig(process.cwd())) ?? FALLBACK;

    for (const path of files(tree)) {
      if (!FORMATTABLE.test(path)) continue;

      const content = tree.read(path)?.toString('utf8');
      if (content === undefined) continue;

      tree.overwrite(
        path,
        await format(content, { ...config, filepath: path }),
      );
    }
  };
}
