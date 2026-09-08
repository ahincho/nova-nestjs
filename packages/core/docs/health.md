# health

Sondas de vida y de disponibilidad para servicios NestJS de Nova Platform, sobre
[`@nestjs/terminus`](https://docs.nestjs.com/recipes/terminus).

```bash
pnpm add @ahincho/nova-nestjs
```

```ts
@Module({
  imports: [
    NovaHealthModule.forRoot({
      legacyPath: 'api/v1/health',
      gracefulShutdownTimeoutMs: 5000,
      readinessChecks: [
        {
          name: 'database',
          check: () => pool.query('select 1').then(() => true),
        },
      ],
    }),
  ],
})
export class AppModule {}
```

Sirve `GET /health/live`, `GET /health/ready` y, si se pide, la ruta heredada.

## Qué pone terminus

Antes el módulo traía su propio corredor de chequeos: fecha límite por chequeo,
ejecución en paralelo, un `try/catch` y la agregación en un cuerpo propio. Eso es
exactamente lo que terminus resuelve, y además:

- **Indicadores hechos** para lo que un servicio suele depender: memoria, disco,
  HTTP, TypeORM, Mongoose, Prisma, Redis por microservicios. Entran por
  `readinessIndicators`, al lado de los `readinessChecks` de siempre.
- **Apagado ordenado.** Con `gracefulShutdownTimeoutMs`, al recibir SIGTERM el
  servicio sigue vivo esa ventana respondiendo 503 con `status: 'shutting_down'`
  en `ready`; el balanceador deja de enviarle tráfico y recién entonces cierra.
  Es lo que evita los errores de los últimos segundos de cada despliegue. Ver
  también [el 503 del apagado](#el-503-del-apagado-es-sobre-conexiones-ya-abiertas),
  que es la parte que se malinterpreta al probarla.
- **Un cuerpo estándar** que cualquiera que haya visto un servicio NestJS
  reconoce.

```json
{
  "status": "error",
  "info": { "database": { "status": "up", "responseTime": 3 } },
  "error": { "cache": { "status": "down", "message": "reported not ready" } },
  "details": {
    "database": { "status": "up", "responseTime": 3 },
    "cache": { "status": "down", "message": "reported not ready" }
  }
}
```

## Vida y disponibilidad no son lo mismo

**`/health/live` responde sin tocar ninguna dependencia, y sin pasar por
terminus.** Una sonda de vida que falla porque la base de datos está caída
consigue que reinicien el contenedor, y eso no levanta la base de datos.
Tampoco cae durante el apagado ordenado: en esa ventana el proceso sigue vivo,
solo dejó de aceptar tráfico nuevo.

**`/health/ready` corre los chequeos registrados** y responde 503 si alguno
falla o si hay un apagado en curso. Corren en paralelo, y **cada uno tiene fecha
límite** (2 s por defecto): una sonda que nunca contesta es peor que una que
dice "no estoy lista", porque el balanceador espera su propio timeout en cada
intento. Un chequeo que lanza cuenta como fallado, con su mensaje en el cuerpo;
no hace falta que se proteja solo.

**La ruta heredada responde como `ready`.** Es la que un target group ya
existente revisa para decidir si la tarea recibe tráfico, así que tiene que caer
con los chequeos y durante el apagado. No se monta si no se indica.

## Dos detalles que evitan un despliegue muerto

**El controlador está exento del sobre de respuesta, y el 503 no es una
excepción.** terminus reporta un fallo lanzando; si esa excepción llegara al
filtro global volvería envuelta en `{ success, status, data, errors }`, y el
balanceador revisa la **forma** del cuerpo tanto como el código. El controlador
la atrapa y responde el cuerpo de terminus tal cual.

**Mover `path` es mover el target group.** Una sonda que responde 404 hace que la
tarea se desregistre unos nueve segundos después de registrarse, y el despliegue
muere diez minutos más tarde con un timeout que se lee como un problema de
recursos. Si usas `globalPrefix`, `bootstrap()` deja las sondas y la ruta
heredada fuera del prefijo por esta misma razón — y activa los hooks de apagado,
sin los cuales la ventana de `gracefulShutdownTimeoutMs` nunca se abre.

## El 503 del apagado es sobre conexiones ya abiertas

`bootstrap()` pasa `return503OnClosing: true` desde NestJS 12. Es la mitad del
apagado que los hooks no cubren: los hooks avisan a los módulos, y esta opción
decide qué contesta el proceso mientras se está apagando.

**Actúa sobre las conexiones ya establecidas.** Una petición que llega por una
conexión que sigue abierta recibe `503 Service Unavailable`. Una conexión TCP
nueva, en cambio, se rechaza antes de que exista una petición HTTP que
contestar, porque el listener ya dejó de aceptar: ahí lo que se ve es un
`ECONNREFUSED`.

Medido sobre un servicio real, con el cierre disparado en t=1200 ms:

| Qué                                      | Cuándo    | Resultado                   |
| ---------------------------------------- | --------- | --------------------------- |
| petición en vuelo cuando llega el cierre | t=3021 ms | **200**, terminó completa   |
| petición nueva, conexión ya abierta      | t=3022 ms | **503 Service Unavailable** |
| petición nueva, conexión TCP nueva       | t=1845 ms | **ECONNREFUSED**            |

Para el caso que importa es exactamente lo que se quiere: **un balanceador
mantiene la conexión abierta**, así que recibe un 503 en vez de encontrarse la
conexión cortada a mitad de una petición.

**Al probarlo a mano se ve al revés.** Un `curl` suelto abre una conexión nueva
y recibe `connection refused`, que se lee como que la opción no funciona. Para
verlo hay que reusar la conexión:

```js
const agent = new http.Agent({ keepAlive: true });
// una petición cualquiera primero, para abrir la conexión;
// después el cierre; después otra por el mismo agente -> 503
```

### Para qué sirve la ventana, y para qué no

**No es lo que saca la tarea de rotación.** Es fácil leerlo así, y en ECS el
orden es al revés: primero se desregistra el target, después se espera el
_deregistration delay_, y **sólo entonces** llega el SIGTERM. Cuando el proceso
se entera de que se está apagando, el balanceador ya dejó de mandarle tráfico.

Lo que la ventana compra es que las peticiones que **ya estaban corriendo**
terminen en vez de morir a la mitad. Se dimensiona por eso: mayor que la
petición más lenta que valga la pena esperar, y **menor que el `stopTimeout` de
la tarea** —30 s por defecto en ECS—, porque pasado ese plazo llega un SIGKILL
sin importar en qué punto del drenaje esté.

El 503 de `shutting_down` sólo lo ve un balanceador que sondee **dentro** de la
ventana. Los target groups de A303 tienen `HealthCheckIntervalSeconds: 60`, así
que con los 5 s que trae el generador no sondean ni una vez. No es un defecto:
es que en ese despliegue el 503 no es el mecanismo que importa, y el valor se
elige por las peticiones en vuelo.

## Opciones

| Opción                      | Por defecto | Para qué                                                    |
| --------------------------- | ----------- | ----------------------------------------------------------- |
| `path`                      | `'health'`  | prefijo de las rutas                                        |
| `legacyPath`                | —           | ruta heredada que un target group ya revisa                 |
| `readinessChecks`           | `[]`        | de qué depende estar listo, en la forma corta               |
| `readinessIndicators`       | `[]`        | indicadores nativos de terminus                             |
| `checkTimeoutMs`            | `2000`      | fecha límite de cada chequeo                                |
| `gracefulShutdownTimeoutMs` | `0`         | cuánto sigue respondiendo 503 antes de cerrar, tras SIGTERM |
