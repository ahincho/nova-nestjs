import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { DEFAULT_STYLE, defaultPathFor, feature } from './feature';
import {
  DEFAULT_STYLE as SERVICE_DEFAULT_STYLE,
  platformVersion,
  service,
} from './service';
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

describe('el generador de servicio', () => {
  // Se lee del package.json del propio paquete en vez de escribirse a mano,
  // para que el servicio quede pineado a la release que lo genero y no a un
  // numero que alguien se olvido de subir.
  it('toma la version de la plataforma del propio paquete', () => {
    const { version } = JSON.parse(
      readFileSync(join(__dirname, '..', 'package.json'), 'utf8'),
    ) as { version: string };

    expect(platformVersion()).toBe(version);
  });

  it('devuelve una regla para los dos sabores', () => {
    expect(typeof service({ name: 'academic-acl' })).toBe('function');
    expect(typeof service({ name: 'home-bff', style: 'bff' })).toBe('function');
  });

  it('usa el layout hexagonal por defecto', () => {
    expect(SERVICE_DEFAULT_STYLE).toBe('acl');
  });
});
