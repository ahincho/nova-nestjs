import { APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core';
import { NovaEnvelopeStandard } from '../api-standard';
import { ApiStandardModule } from './api-standard.module';
import { AllExceptionsFilter } from './filters/all-exceptions.filter';
import { ResponseWrapperInterceptor } from './interceptors/response-wrapper.interceptor';
import {
  API_STANDARD,
  API_STANDARD_OPTIONS,
  DEFAULT_API_STANDARD_OPTIONS,
} from './tokens';

type ClassProvider = {
  provide: unknown;
  useClass?: unknown;
  useValue?: unknown;
};

function providersOf(module: { providers?: unknown[] }): ClassProvider[] {
  return (module.providers ?? []) as ClassProvider[];
}

function findByToken(
  module: { providers?: unknown[] },
  token: unknown,
): ClassProvider | undefined {
  return providersOf(module).find((provider) => provider.provide === token);
}

describe('ApiStandardModule.forRoot', () => {
  it('registers the interceptor, the filter and the resolved options', () => {
    const module = ApiStandardModule.forRoot();

    expect(findByToken(module, APP_INTERCEPTOR)?.useClass).toBe(
      ResponseWrapperInterceptor,
    );
    expect(findByToken(module, APP_FILTER)?.useClass).toBe(AllExceptionsFilter);
    expect(findByToken(module, API_STANDARD_OPTIONS)?.useValue).toEqual(
      DEFAULT_API_STANDARD_OPTIONS,
    );
  });

  // The options provider stays even when both features are off, because other
  // Nova packages read the internal error message from it.
  it('omits the interceptor when response wrapping is off', () => {
    const module = ApiStandardModule.forRoot({ wrapResponses: false });

    expect(findByToken(module, APP_INTERCEPTOR)).toBeUndefined();
    expect(findByToken(module, APP_FILTER)).toBeDefined();
    expect(findByToken(module, API_STANDARD_OPTIONS)).toBeDefined();
  });

  it('omits the filter when exception catching is off', () => {
    const module = ApiStandardModule.forRoot({ catchExceptions: false });

    expect(findByToken(module, APP_FILTER)).toBeUndefined();
    expect(findByToken(module, APP_INTERCEPTOR)).toBeDefined();
  });

  // Global, so a feature module can inject the options without importing this
  // module again - the same reason Nest marks ConfigModule global. El
  // estándar se exporta porque el documento OpenAPI lo arma otro módulo.
  it('is a global module exporting its options and its standard', () => {
    const module = ApiStandardModule.forRoot();

    expect(module.global).toBe(true);
    expect(module.exports).toEqual([API_STANDARD_OPTIONS, API_STANDARD]);
  });

  // Un servicio que no declara nada contesta igual que antes de que el
  // estándar se pudiera reemplazar.
  it('registers the Nova envelope when no standard is declared', () => {
    const provider = findByToken(ApiStandardModule.forRoot(), API_STANDARD);

    expect(provider?.useValue).toBeInstanceOf(NovaEnvelopeStandard);
  });

  it('registers a standard given as an instance as it is', () => {
    const standard = new NovaEnvelopeStandard({
      codes: { byStatus: { 502: 'BAD_GATEWAY' } },
    });

    const provider = findByToken(
      ApiStandardModule.forRoot({ standard }),
      API_STANDARD,
    );

    expect(provider?.useValue).toBe(standard);
  });

  // Una clase se deja a la inyección, para que el estándar pueda recibir sus
  // propias dependencias.
  it('leaves a standard given as a class to injection', () => {
    class OwnStandard extends NovaEnvelopeStandard {}

    const provider = findByToken(
      ApiStandardModule.forRoot({ standard: OwnStandard }),
      API_STANDARD,
    );

    expect(provider?.useClass).toBe(OwnStandard);
  });

  // Reemplazar el estándar no es apagarlo: el interceptor y el filtro siguen
  // registrados, porque son los que aplican las reglas.
  it('keeps the interceptor and the filter with a custom standard', () => {
    const module = ApiStandardModule.forRoot({
      standard: new NovaEnvelopeStandard(),
    });

    expect(findByToken(module, APP_INTERCEPTOR)).toBeDefined();
    expect(findByToken(module, APP_FILTER)).toBeDefined();
  });
});
