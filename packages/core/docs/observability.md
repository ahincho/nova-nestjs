# observability

Contexto de request y redacción de logs para servicios NestJS de Nova Platform.

```bash
pnpm add @ahincho/nova-nestjs
```

## El contexto de request

```ts
@Module({ imports: [NovaObservabilityModule.forRoot()] })
export class AppModule {}
```

Con eso, cada petición abre un contexto sobre `AsyncLocalStorage`, y cualquier
cosa que corra debajo lo lee sin que el valor se pase por cada firma:

```ts
constructor(private readonly context: RequestContextService) {}

this.context.requestId();   // el id de la petición en curso
this.context.headers();     // las cabeceras a propagar
```

Sobrevive a un `await` y mantiene separadas dos peticiones concurrentes. Fuera de
una petición —un job programado, un consumidor— devuelve vacío: inventar una
correlación haría que una traza afirme una relación que no existe.

`headers()` satisface estructuralmente el puerto `OutboundHeadersProvider` del
módulo `http`. **Ninguno de los dos módulos importa al otro**: los une el token
de DI, y por eso cada uno funciona sin el otro.

### Qué se propaga

Por defecto `x-request-id`, `x-user-id` y `x-tenant-id`. El primero es el id de
correlación y **se genera cuando el llamador no lo mandó**; los demás viajan sólo
si venían. Una cabecera ausente o vacía se omite: un `x-user-id` vacío aguas
abajo se lee como "hay un usuario y no tiene id", que es peor que no decir nada.

El id se devuelve además en la respuesta, para que el llamador pueda reportar una
falla citándolo. Un navegador sólo puede leerlo porque la política de CORS expone
esa cabecera.

### El id en el borde

Cómo entra el id y cómo viaja hacia adentro son dos decisiones distintas
(ADR-037). Un frontend puede mandarlo con su propio nombre sin que los servicios
de adentro tengan que enterarse:

```ts
NovaModule.forRoot({
  observability: {
    requestId: { accept: ['transaction-id', 'x-request-id'] },
  },
});
```

- `accept` dice de qué cabeceras se toma el id del llamador, en orden: gana la
  primera que traiga un valor. Con `transaction-id` y después `x-request-id`, el
  mismo servicio sirve al frontend y a otro servicio que le reenvía el id.
- `echo` dice con qué nombre se devuelve. Por defecto, la primera de `accept`:
  el llamador lo recibe con el nombre con que lo mandó.

Hacia los upstreams sigue viajando con la primera de `correlationHeaders`, y es
el mismo valor en todas partes: el que se devuelve, el que viaja, el `traceId`
del log y el del cuerpo de un error. Con `bootstrap({ cors })`, la política de
CORS permite las cabeceras de `accept` y expone la de `echo` sin declararlas
aparte, porque un borde que recibe el id con otro nombre no sirve si el navegador
no puede mandarlo.

Si no llega ninguna, el id se genera, como siempre. Rechazar la petición es una
pregunta que el ADR deja abierta: garantiza que el id del frontend sea el de la
traza, pero rompe a cualquier cliente que no lo mande, y las sondas de salud no
lo mandan nunca.

## El logger

Viene montado. `NovaModule.forRoot()` levanta `nestjs-pino` sobre pino, y
`bootstrap()` lo instala con `app.useLogger()`, así que un `new Logger('X')` de
`@nestjs/common` de toda la vida ya escribe JSON estructurado:

```ts
NovaModule.forRoot({
  observability: { logger: { level: process.env.LOG_LEVEL } },
});
```

**No es opcional a propósito.** El formato del documento de log es un contrato
con quien lo recolecta e indexa: `req.id`, `context`, `level` y `err` son los
campos por los que alguien filtra a las tres de la mañana. Un servicio que arma
el suyo produce líneas que llegan al índice y no aparecen en ninguna consulta
guardada — un contenedor sano e invisible, que es peor que uno caído.

Apagarlo es una decisión explícita, para el servicio que loguea de otra forma:

```ts
NovaModule.forRoot({ observability: { logger: false } });
```

| Opción            | Por defecto        | Para qué                                        |
| ----------------- | ------------------ | ----------------------------------------------- |
| `level`           | `info`             | el nivel de pino                                |
| `pretty`          | `false`            | salida legible en local, nunca en un contenedor |
| `redactHeaders`   | `[]`               | cabeceras a censurar además de las de abajo     |
| `requestIdHeader` | las de `accept`    | de dónde sale el id: una o varias, en orden     |
| `destination`     | la salida estándar | escribir a otro lado, o leerlo desde un test    |

### El id, sin depender del orden

`genReqId` lee las cabeceras de la petición, no el contexto, y las mismas que el
contexto en el mismo orden. Es lo que hace que el id sea uno solo sin importar
qué middleware corrió primero: `pino-http` hace
`req.id = req.id || genReqId(...)`, así que cuando el contexto ya escribió
`req.id` ni se llama; y si pino mirara primero, el contexto adopta el `req.id`
que encuentre en vez de generar otro. Dos ids para una misma petición es igual
que ninguno, porque la traza se corta justo donde alguien la va a buscar.

## Redacción de logs

Redacta `authorization`, `proxy-authorization`, `cookie`, `set-cookie` y
`x-api-key`, **en petición y en respuesta**. Un índice de logs lo lee más gente
que la base de datos que ese token protege, y un token pegado en un buscador es
una credencial que funciona. Se censura en vez de omitir, para que se vea que la
cabecera estaba y fue ocultada.

`genReqId` toma el id del mismo contexto que leen las cabeceras salientes: así un
id sigue a la llamada entre servicios en vez de que cada salto invente el suyo.

`pretty` nunca va encendido por defecto — el recolector de logs de un contenedor
espera un documento JSON por línea.

## Opciones

| Opción               | Por defecto                                    | Para qué                            |
| -------------------- | ---------------------------------------------- | ----------------------------------- |
| `correlationHeaders` | `['x-request-id', 'x-user-id', 'x-tenant-id']` | qué se propaga; la primera es el id |
| `requestId.accept`   | la primera de `correlationHeaders`             | de dónde se toma el id del llamador |
| `requestId.echo`     | la primera de `accept`                         | con qué nombre se devuelve          |
| `generateId`         | `crypto.randomUUID`                            | cómo se genera un id ausente        |
| `echoRequestId`      | `true`                                         | devolver el id en la respuesta      |
