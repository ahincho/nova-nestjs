import { Injectable } from '@nestjs/common';

// Toda la inyeccion por tipo de NestJS se apoya en que el transpilador emita
// `design:paramtypes`. Cuando deja de emitirse no falla el transpilador: falla
// cada modulo que se arma en un test, con un error que habla de un token
// indefinido y manda a buscar en el lugar equivocado. Este spec es el que dice
// cual es el lugar correcto.
@Injectable()
class MetadataProbeDependency {}

@Injectable()
class MetadataProbeConsumer {
  constructor(readonly dependency: MetadataProbeDependency) {}
}

describe('decorator metadata', () => {
  it('emits constructor parameter types', () => {
    const types = Reflect.getMetadata(
      'design:paramtypes',
      MetadataProbeConsumer,
    ) as unknown[] | undefined;

    expect(types).toEqual([MetadataProbeDependency]);
  });
});
