/**
 * Los dos sabores de servicio que la plataforma reconoce.
 *
 * Es la misma distincion que hace el schematic `feature`, y por el mismo
 * motivo: un BFF saca sus adaptadores de salida a `src/upstream/` para
 * compartirlos entre pantallas, y un ACL los deja dentro de cada contexto
 * acotado y agrega `domain/`.
 *
 * Lo que cambia entre los dos no es solo el arbol de carpetas sino las reglas
 * de arquitectura que se generan, que son las que sostienen esa forma.
 */
export type ServiceStyle = 'bff' | 'acl';

export type ServiceOptions = {
  /** Nombre del servicio, en kebab-case o camelCase. */
  name: string;

  /** Sabor a generar. Por defecto `acl`, igual que `feature`. */
  style?: ServiceStyle;

  /** Donde escribirlo. Por defecto un directorio con el nombre del servicio. */
  path?: string;
};
