import { HostTree } from '@angular-devkit/schematics';
import { formatted } from './formatted';
import type { SchematicContext, Tree } from '@angular-devkit/schematics';

/**
 * La regla se aplica a mano sobre un árbol de memoria. Lo que importa no es que
 * llame a Prettier sino que el resultado esté formateado: es la diferencia
 * entre un servicio generado que pasa su `format:check` y uno que no.
 */
async function apply(tree: Tree): Promise<Tree> {
  const rule = formatted();
  await rule(tree, {} as SchematicContext);
  return tree;
}

describe('formatted', () => {
  it('formatea el TypeScript que emite el generador', async () => {
    const tree = new HostTree();
    tree.create('/src/a.ts', 'export const x = {a:1,   b:2}\n');

    await apply(tree);

    expect(tree.readText('/src/a.ts')).toBe(
      'export const x = { a: 1, b: 2 };\n',
    );
  });

  // Es la razón de existir de la regla: una plantilla escrita para un nombre
  // corto se pasa de ancho con uno largo, y Prettier lo reenvuelve.
  it('reenvuelve lo que el nombre renderizado desbordó', async () => {
    const tree = new HostTree();
    tree.create(
      '/src/b.ts',
      "export const GET_ACADEMIC_COURSE_ENROLLMENT_DETAIL_USE_CASE = Symbol('GET_ACADEMIC_COURSE_ENROLLMENT_DETAIL_USE_CASE');\n",
    );

    await apply(tree);

    expect(tree.readText('/src/b.ts').split('\n').length).toBeGreaterThan(2);
  });

  it('no toca lo que Prettier no sabe formatear', async () => {
    const tree = new HostTree();
    tree.create('/src/logo.png', 'no soy texto');

    await apply(tree);

    expect(tree.readText('/src/logo.png')).toBe('no soy texto');
  });

  it('formatea también el JSON y el Markdown', async () => {
    const tree = new HostTree();
    tree.create('/package.json', '{"name":"x"}');

    await apply(tree);

    expect(tree.readText('/package.json')).toContain('"name": "x"');
  });
});
