import { normalizePath, templateVariables, toEnvPrefix } from './naming';

describe('toEnvPrefix', () => {
  // Tiene que dar exactamente lo mismo que la funcion homonima de
  // @ahincho/nova-nestjs-config: lo que se genera aca es el codigo que despues
  // lee esas variables, y una diferencia se descubre en produccion.
  it.each([
    ['academic-orchestrator', 'ACADEMIC_ORCHESTRATOR'],
    ['academicOrchestrator', 'ACADEMIC_ORCHESTRATOR'],
    ['academic_orchestrator', 'ACADEMIC_ORCHESTRATOR'],
    ['courses', 'COURSES'],
  ])('convierte %s en %s', (name, expected) => {
    expect(toEnvPrefix(name)).toBe(expected);
  });
});

describe('normalizePath', () => {
  it.each([
    ['src/upstream/academic', 'src/upstream/academic'],
    ['src\\upstream\\academic', 'src/upstream/academic'],
    ['/src/upstream/academic/', 'src/upstream/academic'],
  ])('normaliza %s', (raw, expected) => {
    expect(normalizePath(raw)).toBe(expected);
  });
});

describe('templateVariables', () => {
  it('entrega el nombre en kebab-case y su prefijo de entorno', () => {
    expect(templateVariables('academicOrchestrator')).toEqual({
      name: 'academic-orchestrator',
      envPrefix: 'ACADEMIC_ORCHESTRATOR',
    });
  });
});
