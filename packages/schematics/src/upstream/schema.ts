export type UpstreamOptions = {
  /** Nombre del upstream, en kebab-case o camelCase. */
  name: string;

  /** Dónde escribirlo. Por defecto `src/upstream/<name>`. */
  path?: string;
};
