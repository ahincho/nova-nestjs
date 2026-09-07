import { EnvironmentError } from './environment';
import { APP_ENVIRONMENTS, appEnvironment } from './app-environment';

describe('appEnvironment', () => {
  afterEach(() => {
    delete process.env['APP_ENV'];
  });

  it.each(APP_ENVIRONMENTS)('reads %s', (environment) => {
    process.env['APP_ENV'] = environment;

    expect(appEnvironment()).toBe(environment);
  });

  it('accepts it however it was typed', () => {
    process.env['APP_ENV'] = '  PROD ';

    expect(appEnvironment()).toBe('prod');
  });

  // Es lo que hace confiable la imagen única: el contenedor que nadie
  // configuró no arranca creyéndose otro ambiente.
  it('refuses to guess when the variable is missing', () => {
    expect(() => appEnvironment()).toThrow(EnvironmentError);
    expect(() => appEnvironment()).toThrow(/APP_ENV/u);
  });

  it('refuses a value that is not one of the three', () => {
    process.env['APP_ENV'] = 'staging';

    expect(() => appEnvironment()).toThrow(/dev, qa, prod/u);
  });

  // Un valor en blanco es lo que produce una task definition a la que le
  // dejaron la variable vacía, y no es una configuración legítima.
  it('treats a blank value as missing', () => {
    process.env['APP_ENV'] = '   ';

    expect(() => appEnvironment()).toThrow(/was not set/u);
  });
});
