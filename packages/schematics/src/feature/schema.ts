/**
 * Los dos layouts que conviven en la plataforma.
 *
 * Son la misma arquitectura hexagonal con una diferencia: un BFF saca sus
 * adaptadores de salida a `src/upstream/` para compartirlos entre features, y
 * un ACL los deja dentro del feature y agrega `domain/`.
 */
export type FeatureStyle = 'bff' | 'acl';

export type FeatureOptions = {
  /** Nombre del feature, en kebab-case o camelCase. */
  name: string;

  /** Layout a generar. Por defecto `acl`, que es el canonico. */
  style?: FeatureStyle;

  /** Dónde escribirlo. Por defecto depende del layout. */
  path?: string;
};
