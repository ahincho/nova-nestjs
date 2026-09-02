import { strings } from '@angular-devkit/core';

/**
 * Deriva el prefijo de las variables de entorno de un upstream.
 *
 * Tiene que dar exactamente lo mismo que `toEnvPrefix` de
 * `@ahincho/nova-nestjs-config`, porque lo que genera este paquete es el codigo
 * que despues lee esas variables. Se reimplementa en vez de importarse para no
 * arrastrar el framework entero como dependencia de una herramienta de
 * andamiaje - la contraparte esta cubierta por los tests de los dos lados.
 */
export function toEnvPrefix(name: string): string {
  return name
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .replace(/[-\s]+/g, '_')
    .toUpperCase();
}

/**
 * Normaliza una ruta a la forma que espera el arbol de schematics: separadores
 * hacia adelante y sin barra inicial ni final.
 */
export function normalizePath(path: string): string {
  return path.replace(/\\/g, '/').replace(/^\/+/, '').replace(/\/+$/, '');
}

/**
 * Las variables que toda plantilla recibe, ademas de los helpers de strings.
 */
export function templateVariables(name: string): Record<string, string> {
  const dasherized = strings.dasherize(name);

  return {
    name: dasherized,
    envPrefix: toEnvPrefix(dasherized),
  };
}
