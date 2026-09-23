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
| `requestIdHeader` | la de correlación  | de dónde sale el id                             |
| `destination`     | la salida estándar | escribir a otro lado, o leerlo desde un test    |

### El id, sin depender del orden

`genReqId` lee la cabecera de la petición, no el contexto. Es lo que hace que el
id sea uno solo sin importar qué middleware corrió primero: `pino-http` hace
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
| `generateId`         | `crypto.randomUUID`                            | cómo se genera un id ausente        |
| `echoRequestId`      | `true`                                         | devolver el id en la respuesta      |
