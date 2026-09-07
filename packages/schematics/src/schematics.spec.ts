import { SchematicTestRunner } from '@angular-devkit/schematics/testing';
import { existsSync, readFileSync } from 'node:fs';
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

describe('el generador de servicio', () => {
  let tree: UnitTestTree;

  beforeAll(async () => {
    tree = await runner.runSchematic('service', { name: 'academic-acl' });
  });

  // Lo que NO genera es el argumento del paquete: en los templates de los que
  // sale esta forma, `common/` y `core/` eran entre el 40 % y el 50 % de src.
  it('no genera common/ ni core/, que los trae la plataforma', () => {
    expect(
      tree.files.filter((file) => /\/src\/(common|core)\//.test(file)),
    ).toEqual([]);
  });

  it('declara solo los tres paquetes de la plataforma', () => {
    const manifest = JSON.parse(
      tree.readContent('/academic-acl/package.json'),
    ) as {
      dependencies: Record<string, string>;
      devDependencies: Record<string, string>;
    };

    expect(Object.keys(manifest.dependencies)).toEqual([
      '@ahincho/nova-nestjs',
    ]);
    expect(Object.keys(manifest.devDependencies).sort()).toEqual([
      '@ahincho/nova-nestjs-schematics',
      '@ahincho/nova-nestjs-toolchain',
    ]);
  });

  // Si un script nombrara la herramienta, cambiar de runner volveria a obligar
  // a editar cada servicio, que es justo lo que el comando `nova` resolvio.
  it('no deja ningun script nombrando una herramienta', () => {
    const manifest = JSON.parse(
      tree.readContent('/academic-acl/package.json'),
    ) as { scripts: Record<string, string> };

    const named = Object.entries(manifest.scripts).filter(
      ([, command]) =>
        !command.startsWith('nova ') && command !== 'node dist/main',
    );

    expect(named).toEqual([]);
  });

  it('pinea la version del propio paquete', () => {
    const manifest = tree.readContent('/academic-acl/package.json');
    const { version } = JSON.parse(
      readFileSync(join(__dirname, '..', 'package.json'), 'utf8'),
    ) as { version: string };

    expect(manifest).toContain(`"@ahincho/nova-nestjs": "^${version}"`);
  });

  // El generador tiene que emitir algo que pase su propia puerta de calidad, y
  // el motor de plantillas del DevKit devuelve CRLF en Windows.
  it('escribe con finales de linea LF', () => {
    for (const file of tree.files) {
      expect(tree.readContent(file)).not.toContain('\r\n');
    }
  });

  it('nace con un test que prueba las sondas', () => {
    expect(tree.files).toContain('/academic-acl/test/app.e2e-spec.ts');
  });

  // Los dos archivos que deciden si el servicio funciona en manos de otra
  // persona. Sin el .npmrc, `pnpm install` busca `@ahincho/*` en npmjs y corta
  // con un 404, porque la plataforma se publica en GitHub Packages. Sin el
  // .gitattributes, un clon en Windows queda en CRLF y `nova format:check`
  // falla en local mientras pasa en el runner de Linux.
  it('fija el registry y el fin de línea', () => {
    expect(tree.readContent('/academic-acl/.npmrc')).toContain(
      '@ahincho:registry=https://npm.pkg.github.com',
    );
    expect(tree.readContent('/academic-acl/.gitattributes')).toContain(
      '* text=auto eol=lf',
    );
  });

  // El Dockerfile lo comparten todos los servicios y vive en el toolchain, pero
  // el .dockerignore no puede: Docker lo lee desde la raíz del contexto. Sin él
  // se copian los binarios nativos de Windows dentro de una imagen Linux y el
  // fallo aparece recién al arrancar el contenedor.
  it('excluye node_modules del contexto de build', () => {
    expect(tree.readContent('/academic-acl/.dockerignore')).toContain(
      'node_modules/',
    );
  });

  it('publica su documentación OpenAPI', () => {
    const main = tree.readContent('/academic-acl/src/main.ts');

    expect(main).toContain('openapi:');
    expect(main).toContain("process.env['OPENAPI_ENABLED'] !== 'false'");
    // Nace sin `auth`, así que declarar que todo pide token sería mentira.
    expect(main).toContain('bearerAuth: false');
  });

  describe('las reglas de arquitectura', () => {
    it('son genericas, para que no se queden viejas al agregar un contexto', () => {
      const rules = tree.readContent('/academic-acl/.dependency-cruiser.js');

      expect(rules).toContain("const CONTEXT = '[^/]+'");
      expect(rules).toContain('service-must-not-import-adapter');
      expect(rules).toContain('context-must-not-import-another-context');
    });

    it('las del bff hablan de features y upstream', async () => {
      const bff = await runner.runSchematic('service', {
        name: 'home-bff',
        style: 'bff',
      });
      const rules = bff.readContent('/home-bff/.dependency-cruiser.js');

      expect(rules).toContain('feature-uses-only-the-upstream-port');
      expect(rules).toContain('upstream-must-not-import-another-upstream');
    });
  });
});
