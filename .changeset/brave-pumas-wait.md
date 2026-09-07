---
'@ahincho/nova-nestjs-schematics': patch
---

El paso que levanta el contenedor ya puede decir por qué falló.

Corría `docker run --rm`, y con esa bandera un contenedor que muere al arrancar se borra solo:
el `docker logs` del final -que es lo único que explica la causa- contestaba «No such
container». El paso que existe para diagnosticar el arranque era justamente el que no podía
diagnosticarlo.

Salió de que el servicio de ejemplo no levantara: le faltaba la variable de su upstream, y el
log que lo decía ya no existía cuando se fue a leer.
