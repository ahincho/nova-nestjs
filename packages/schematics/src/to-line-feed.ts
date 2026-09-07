import { forEach, type FileEntry, type Rule } from '@angular-devkit/schematics';

/**
 * Normaliza a LF lo que emite el motor de plantillas.
 *
 * En Windows el DevKit devuelve CRLF aunque la plantilla en disco esté en LF, y
 * entonces **el proyecto recién generado falla su propio `format:check`**: el
 * primer contacto con el generador es un fallo de formato en código que nadie
 * escribió.
 *
 * Va en un archivo aparte porque los tres schematics lo necesitan por igual.
 * Cuando sólo lo tenía `service`, un `nova generate feature` en Windows seguía
 * emitiendo CRLF, y eso no lo vio nadie hasta que el generador de servicio
 * empezó a encadenar al de feature.
 */
export const toLineFeed: Rule = forEach((entry: FileEntry) => ({
  path: entry.path,
  content: Buffer.from(entry.content.toString('utf8').replaceAll('\r\n', '\n')),
}));
