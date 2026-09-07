import {
  APP_ENVIRONMENTS,
  DEFAULT_APP_ENVIRONMENT,
  appEnvironment,
} from './app-environment';
import { EnvironmentError } from './environment';

describe('appEnvironment', () => {
  const original = process.env['NODE_ENV'];

  afterEach(() => {
    if (original === undefined) {
      delete process.env['NODE_ENV'];
    } else {
      process.env['NODE_ENV'] = original;
    }
  });

  // Son los valores que inyectan las task definitions de verdad, no una
  // convención inventada: `development` y `qa` en los siete BFF de hoy.
  it.each(APP_ENVIRONMENTS)('reads %s', (environment) => {
    process.env['NODE_ENV'] = environment;

    expect(appEnvironment()).toBe(environment);
  });

  it('accepts it however it was typed', () => {
    process.env['NODE_ENV'] = '  QA ';

    expect(appEnvironment()).toBe('qa');
  });

  // La imagen trae `production`, así que un contenedor sin inyectar nada se
  // comporta como el ambiente más restrictivo en vez de abrirse.
  it('falls back to the most restrictive one', () => {
    delete process.env['NODE_ENV'];

    expect(appEnvironment()).toBe(DEFAULT_APP_ENVIRONMENT);
    expect(DEFAULT_APP_ENVIRONMENT).toBe('production');
  });

  it('treats a blank value as absent', () => {
    process.env['NODE_ENV'] = '   ';

    expect(appEnvironment()).toBe('production');
  });

  // Un `dev` mal escrito no es «algo que no es producción»: es una task
  // definition rota, y el contenedor tiene que decirlo al arrancar.
  it('refuses a value that is not one of the three', () => {
    process.env['NODE_ENV'] = 'dev';

    expect(() => appEnvironment()).toThrow(EnvironmentError);
    expect(() => appEnvironment()).toThrow(/development, qa, production/u);
  });
});
