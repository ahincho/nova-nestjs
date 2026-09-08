---
'@ahincho/nova-nestjs': patch
'@ahincho/nova-nestjs-schematics': patch
---

La ventana de apagado decía servir para algo que no hace.

`gracefulShutdownTimeoutMs` estaba documentado -en la opción, en `health.md`, en la plantilla del
generador- como el mecanismo que le da tiempo al balanceador a sacar la tarea de rotación, y como
un valor que conviene **mayor al intervalo de la sonda**.

Las dos cosas son falsas. En ECS el orden es al revés: primero se desregistra el target, después
se espera el _deregistration delay_, y sólo entonces llega el SIGTERM; cuando el proceso se
entera, el balanceador ya dejó de mandarle tráfico. Y los target groups de A303 tienen
`HealthCheckIntervalSeconds: 60`, así que no hay valor razonable que cumpla esa regla: los 5000 ms
que trae el generador son doce veces menores.

El valor está bien, la explicación no. La ventana sirve para que las peticiones **en vuelo**
terminen, y se dimensiona por eso: mayor que la petición más lenta que valga la pena esperar, y
menor que el `stopTimeout` de la tarea -30 s por defecto-, porque pasado ese plazo llega un
SIGKILL a mitad del drenaje.
