import { DEFAULT_STYLE, defaultPathFor, feature } from './feature';
import { upstream } from './upstream';

/**
 * Estas pruebas miran el fuente, no `dist`.
 *
 * La suite de `schematics.spec.ts` corre la coleccion compilada, que es lo que
 * se instala, pero por eso mismo no puede reportar cobertura del fuente. Lo que
 * si es medible desde aca es la parte pura: como se decide la ruta y que las
 * fabricas devuelven una regla.
 */
describe('defaultPathFor', () => {
  // Un BFF los agrupa bajo features/ porque sus adaptadores de salida estan
  // afuera, compartidos; un ACL los pone al primer nivel porque cada uno se
  // lleva los suyos dentro.
  it.each([
    ['acl' as const, 'buildings', 'src/buildings'],
    ['bff' as const, 'courses', 'src/features/courses'],
  ])('en estilo %s pone %s en %s', (style, name, expected) => {
    expect(defaultPathFor(style, name)).toBe(expected);
  });

  it('trata acl como el layout canonico', () => {
    expect(DEFAULT_STYLE).toBe('acl');
  });
});

describe('las fabricas', () => {
  it('devuelven una regla sin tocar el disco', () => {
    expect(typeof upstream({ name: 'academic' })).toBe('function');
    expect(typeof feature({ name: 'buildings' })).toBe('function');
    expect(typeof feature({ name: 'courses', style: 'bff' })).toBe('function');
  });

  it('aceptan una ruta explicita', () => {
    expect(typeof upstream({ name: 'academic', path: 'src/x' })).toBe(
      'function',
    );
    expect(typeof feature({ name: 'events', path: 'src/y' })).toBe('function');
  });
});
