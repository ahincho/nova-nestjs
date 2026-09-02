import { cp, readdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Copia a dist lo que `tsc` no toca: la coleccion y las plantillas.
 *
 * Las plantillas terminan en `.template` a proposito - sin esa extension `tsc`
 * intentaria compilarlas, y no son TypeScript valido: llevan marcas de EJS
 * dentro de las declaraciones.
 */
const here = dirname(fileURLToPath(import.meta.url));
const src = join(here, '..', 'src');
const dist = join(here, '..', 'dist');

await cp(join(src, 'collection.json'), join(dist, 'collection.json'));

for (const entry of await readdir(src, { withFileTypes: true })) {
  if (!entry.isDirectory()) {
    continue;
  }

  const schema = join(src, entry.name, 'schema.json');
  await cp(schema, join(dist, entry.name, 'schema.json')).catch(
    () => undefined,
  );

  await cp(join(src, entry.name, 'files'), join(dist, entry.name, 'files'), {
    recursive: true,
  }).catch(() => undefined);
}

console.log('assets copiados a dist');
