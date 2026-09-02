import { SchematicTestRunner } from '@angular-devkit/schematics/testing';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import type { UnitTestTree } from '@angular-devkit/schematics/testing';

/**
 * La suite corre contra `dist`, no contra `src`.
 *
 * Un paquete de schematics publica plantillas, no solo codigo: el runner las
 * carga desde disco con `require`, asi que probar el fuente probaria algo que
 * nadie instala. `pnpm verify` compila antes de testear, que es el orden que
 * este archivo asume.
 */
const COLLECTION = join(__dirname, '..', 'dist', 'collection.json');

const runner = new SchematicTestRunner('nova', COLLECTION);

beforeAll(() => {
  if (!existsSync(COLLECTION)) {
    throw new Error(
      `No existe ${COLLECTION}. Corre \`pnpm build\` en este paquete antes de los tests.`,
    );
  }
});

describe('el generador de upstream', () => {
  let tree: UnitTestTree;

  beforeAll(async () => {
    tree = await runner.runSchematic('upstream', {
      name: 'academic-orchestrator',
    });
  });

  it('escribe los cuatro archivos que declaran un upstream', () => {
    expect(tree.files.sort()).toEqual([
      '/src/upstream/academic-orchestrator/academic-orchestrator.client.spec.ts',
      '/src/upstream/academic-orchestrator/academic-orchestrator.client.ts',
      '/src/upstream/academic-orchestrator/academic-orchestrator.config.ts',
      '/src/upstream/academic-orchestrator/academic-orchestrator.module.ts',
    ]);
  });

  it('declara el upstream con defineUpstream', () => {
    const config = tree.readContent(
      '/src/upstream/academic-orchestrator/academic-orchestrator.config.ts',
    );

    expect(config).toContain(
      "import { defineUpstream } from '@ahincho/nova-nestjs'",
    );
    expect(config).toContain(
      "export const academicOrchestrator = defineUpstream('academic-orchestrator')",
    );
  });

  // El comentario del archivo nombra las variables que hay que inyectar, que
  // es lo primero que alguien busca cuando el servicio no arranca.
  it('nombra las variables de entorno que va a leer', () => {
    const config = tree.readContent(
      '/src/upstream/academic-orchestrator/academic-orchestrator.config.ts',
    );

    expect(config).toContain('ACADEMIC_ORCHESTRATOR_URL');
    expect(config).toContain('ACADEMIC_ORCHESTRATOR_TIMEOUT_MS');
  });

  it('genera un cliente sobre el HttpClientService de la plataforma', () => {
    const client = tree.readContent(
      '/src/upstream/academic-orchestrator/academic-orchestrator.client.ts',
    );

    expect(client).toContain('export class AcademicOrchestratorClient');
    expect(client).toContain('HttpClientService');
    expect(client).toContain('timeoutMs: this.config.timeoutMs');
  });

  it('registra la configuracion con ConfigModule.forFeature', () => {
    const module = tree.readContent(
      '/src/upstream/academic-orchestrator/academic-orchestrator.module.ts',
    );

    expect(module).toContain('ConfigModule.forFeature(academicOrchestrator)');
    expect(module).toContain('exports: [AcademicOrchestratorClient]');
  });

  it('acepta un nombre en camelCase y lo normaliza', async () => {
    const camel = await runner.runSchematic('upstream', {
      name: 'academicOrchestrator',
    });

    expect(camel.files).toContain(
      '/src/upstream/academic-orchestrator/academic-orchestrator.config.ts',
    );
  });

  it('respeta una ruta explicita', async () => {
    const custom = await runner.runSchematic('upstream', {
      name: 'academic',
      path: 'src/adapters/out/academic',
    });

    expect(custom.files).toContain(
      '/src/adapters/out/academic/academic.config.ts',
    );
  });
});

describe('el generador de feature', () => {
  it('en estilo acl deja los adaptadores dentro y agrega domain', async () => {
    const tree = await runner.runSchematic('feature', {
      name: 'buildings',
      style: 'acl',
    });

    expect(tree.files.sort()).toEqual([
      '/src/buildings/adapter/in/web/buildings.controller.ts',
      '/src/buildings/adapter/in/web/response/buildings.response.ts',
      '/src/buildings/buildings.module.ts',
      '/src/buildings/domain/buildings.ts',
      '/src/buildings/port/in/get-buildings.use-case.ts',
      '/src/buildings/port/out/find-buildings.port.ts',
      '/src/buildings/service/buildings.service.spec.ts',
      '/src/buildings/service/buildings.service.ts',
    ]);
  });

  // En un BFF los adaptadores de salida viven en src/upstream/ porque los
  // comparten varios features, asi que el feature no los lleva dentro.
  it('en estilo bff agrupa bajo features y no genera domain', async () => {
    const tree = await runner.runSchematic('feature', {
      name: 'courses',
      style: 'bff',
    });

    expect(tree.files.sort()).toEqual([
      '/src/features/courses/courses.controller.ts',
      '/src/features/courses/courses.module.ts',
      '/src/features/courses/courses.service.spec.ts',
      '/src/features/courses/courses.service.ts',
      '/src/features/courses/dto/courses-query.dto.ts',
      '/src/features/courses/dto/courses.response.ts',
      '/src/features/courses/port/in/get-courses.use-case.ts',
    ]);
  });

  it('usa acl cuando no se dice el estilo', async () => {
    const tree = await runner.runSchematic('feature', { name: 'events' });

    expect(tree.files).toContain('/src/events/domain/events.ts');
  });

  it('conecta el servicio con su puerto de salida por token', async () => {
    const tree = await runner.runSchematic('feature', { name: 'buildings' });
    const service = tree.readContent(
      '/src/buildings/service/buildings.service.ts',
    );

    expect(service).toContain('FIND_BUILDINGS_PORT');
    expect(service).toContain('implements GetBuildingsUseCase');
    expect(service).toContain('NotFoundException');
  });

  it('genera un controlador que devuelve la respuesta sin envolverla', async () => {
    const tree = await runner.runSchematic('feature', { name: 'buildings' });
    const controller = tree.readContent(
      '/src/buildings/adapter/in/web/buildings.controller.ts',
    );

    expect(controller).toContain("@Controller('buildings')");
    expect(controller).not.toContain('ApiResponses');
  });

  it('respeta una ruta explicita', async () => {
    const tree = await runner.runSchematic('feature', {
      name: 'events',
      path: 'src/modules/events',
    });

    expect(tree.files).toContain('/src/modules/events/events.module.ts');
  });
});
