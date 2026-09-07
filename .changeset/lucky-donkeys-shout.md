---
'@ahincho/nova-nestjs-schematics': patch
---

El README dice que hay que commitear el lockfile antes del primer push.

El generador no escribe `pnpm-lock.yaml` -resolver el árbol es lo que hace el install- y el
workflow que ahora trae instala con `--frozen-lockfile`, que es lo correcto en CI. Sin ese
archivo la primera corrida de un servicio nuevo muere en el primer paso, y el mensaje de pnpm no
dice que falte commitear nada.

Salió de empujar un servicio generado a un repositorio real:
[`ahincho/nova-nestjs-generated`](https://github.com/ahincho/nova-nestjs-generated), que queda
publicado como referencia de lo que emite el generador.
