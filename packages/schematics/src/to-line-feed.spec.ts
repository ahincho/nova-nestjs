import { HostTree } from '@angular-devkit/schematics';
import { toLineFeed } from './to-line-feed';
import type { SchematicContext, Tree } from '@angular-devkit/schematics';

/**
 * En Windows el motor de plantillas del DevKit devuelve CRLF aunque la
 * plantilla en disco esté en LF, y entonces el proyecto recién generado falla
 * su propio `format:check`.
 */
describe('toLineFeed', () => {
  async function apply(tree: Tree): Promise<Tree> {
    await toLineFeed(tree, {} as SchematicContext);
    return tree;
  }

  it('convierte CRLF en LF', async () => {
    const tree = new HostTree();
    tree.create('/src/a.ts', 'const a = 1;\r\nconst b = 2;\r\n');

    await apply(tree);

    expect(tree.readText('/src/a.ts')).toBe('const a = 1;\nconst b = 2;\n');
  });

  it('deja intacto lo que ya venía en LF', async () => {
    const tree = new HostTree();
    tree.create('/src/b.ts', 'const a = 1;\n');

    await apply(tree);

    expect(tree.readText('/src/b.ts')).toBe('const a = 1;\n');
  });
});
