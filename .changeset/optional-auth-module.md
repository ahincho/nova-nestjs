---
'@ahincho/nova-nestjs': minor
---

Autenticación por JWT como módulo opcional. `NovaModule.forRoot({ auth: {} })`
pone un guard global: cada ruta exige `Authorization: Bearer <jwt>` y el
controlador recibe un `Principal` con `@CurrentUser()`. Lo que no la necesita se
marca con `@Public()`, y las sondas de salud ya lo traen. Omitir `auth` deja el
servicio exactamente como estaba.

El guard **no verifica la firma por defecto**: lee los claims del token tal como
vino, que es lo correcto detrás de un gateway que ya lo validó. Un servicio
expuesto directo pone la verificación real en la opción `verify`.

El identificador sale de `preferred_username` y el rol de `realm_access.roles`,
las dos configurables junto con la normalización, los roles preferidos y los que
se descartan. Cuando el módulo de observabilidad está activo, el identificador
se agrega al contexto y viaja como `x-user-id` hacia cada upstream sin que ningún
punto de llamada lo pase.

`RequestContextService` suma `enrich()`, que agrega cabeceras al contexto de la
petición en vuelo. Existe para lo que se sabe después de abrirlo: el middleware
corre antes que cualquier guard.
