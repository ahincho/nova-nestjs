/**
 * Reglas de arquitectura del ACL, verificadas en CI con `nova lint:arch`.
 * Equivalente a ArchUnit en Java.
 *
 * La idea de fondo: la frontera entre el modelo propio y el del sistema externo
 * no se sostiene con acuerdos de equipo, se sostiene con el CI.
 *
 * El `name` de cada regla va en inglés porque es un identificador: aparece en
 * la salida, y es la clave con la que un baseline de `--ignore-known` la
 * referencia. El `comment` va en español porque lo lee una persona cuando la
 * regla salta.
 *
 * **Las reglas son genéricas.** `CONTEXT` es un comodín, así que aplican a
 * cualquier contexto acotado que se agregue sin tocar este archivo. Enumerarlos
 * a mano es como una regla se queda vieja sin que nadie lo note: sigue en
 * verde, pero ya no mira los contextos nuevos.
 */
const CONTEXT = '[^/]+';

module.exports = {
  forbidden: [
    // ---------------------------------------------------------------
    // NÚCLEO
    // ---------------------------------------------------------------
    {
      name: 'domain-depends-on-nothing',
      severity: 'error',
      comment:
        'domain/ es el contrato interno. Si conoce un adapter, un puerto o un framework, dejó de ser independiente del sistema externo.',
      from: { path: `^src/(${CONTEXT})/domain/` },
      to: { path: '^src/$1/(port|service|adapter|exception)/' },
    },
    {
      name: 'exceptions-depend-on-nothing',
      severity: 'error',
      comment:
        'Las excepciones de dominio son Error puro. Si heredan o importan de Nest, el núcleo queda atado al transporte HTTP.',
      from: { path: `^src/(${CONTEXT})/exception/` },
      to: { path: '^src/$1/(port|service|adapter|domain)/' },
    },
    {
      name: 'service-must-not-import-adapter',
      severity: 'error',
      comment:
        'LA REGLA CENTRAL. El núcleo orquesta la traducción sin saber quién está del otro lado. Si el service importa un adapter, el ACL dejó de proteger nada.',
      from: { path: `^src/(${CONTEXT})/service/` },
      to: { path: '^src/$1/adapter/' },
    },
    {
      name: 'port-must-not-import-adapter',
      severity: 'error',
      comment:
        'El puerto lo declara el núcleo y lo implementa el adapter. Si el puerto conoce al adapter, la dependencia está al revés.',
      from: { path: `^src/(${CONTEXT})/port/` },
      to: { path: '^src/$1/(adapter|service)/' },
    },

    // ---------------------------------------------------------------
    // BORDES
    // ---------------------------------------------------------------
    {
      name: 'edges-must-not-know-each-other',
      severity: 'error',
      comment:
        'Entrada y salida se comunican SÓLO a través del núcleo. Si se importan entre sí, el service quedó de adorno.',
      from: { path: `^src/(${CONTEXT})/adapter/(in|out)/([^/]+)/` },
      to: {
        path: '^src/$1/adapter/(in|out)/',
        pathNot: '^src/$1/adapter/$2/$3/',
      },
    },
    {
      name: 'upstream-dtos-stay-in-their-adapter',
      severity: 'error',
      comment:
        'El modelo crudo del sistema externo muere en su adapter. Si aparece en el núcleo o en el borde web, se filtró: eso es exactamente lo que el ACL existe para impedir.',
      from: { pathNot: `^src/${CONTEXT}/adapter/out/restclient/` },
      to: { path: `^src/${CONTEXT}/adapter/out/restclient/response/` },
    },
    {
      name: 'web-contracts-stay-at-the-web-edge',
      severity: 'error',
      comment:
        'request/ y response/ son la forma del JSON público. El núcleo no debe saber qué shape tiene lo que sale.',
      from: { pathNot: `^src/${CONTEXT}/adapter/in/web/` },
      to: { path: `^src/${CONTEXT}/adapter/in/web/(request|response)/` },
    },

    // ---------------------------------------------------------------
    // ENTRE CONTEXTOS
    // ---------------------------------------------------------------
    {
      name: 'context-must-not-import-another-context',
      severity: 'error',
      comment:
        'Cada contexto acotado es independiente. Si dos comparten algo, ese algo es de la plataforma o es un tercer contexto, no una importación cruzada.',
      from: { path: `^src/(${CONTEXT})/` },
      to: { path: `^src/${CONTEXT}/`, pathNot: '^src/$1/' },
    },

    {
      name: 'no-circular-dependencies',
      severity: 'error',
      from: {},
      to: { circular: true },
    },
  ],
  options: {
    doNotFollow: { path: 'node_modules' },
    tsConfig: { fileName: 'tsconfig.json' },
    tsPreCompilationDeps: true,
    // `[.]` en vez de un backslash escapado: significan lo mismo y una clase de
    // carácter no se puede perder al pasar por una plantilla ni por un editor.
    // Con el escape mal puesto la expresión queda como `.`, que acepta
    // cualquier carácter, y nada avisa.
    exclude: { path: '[.]spec[.]ts$' },
  },
};
