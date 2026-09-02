# @nova-platform/nestjs-observability

Contexto de request y redacción de logs para servicios NestJS de Nova Platform.

```bash
pnpm add @nova-platform/nestjs-observability
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

`headers()` satisface estructuralmente el puerto `OutboundHeadersProvider` de
`@nova-platform/nestjs-http`. **Ninguno de los dos paquetes importa al otro**:
los une `@nova-platform/nestjs`, y por eso los dos sirven por separado.

### Qué se propaga

Por defecto `x-request-id`, `x-user-id` y `x-tenant-id`. El primero es el id de
correlación y **se genera cuando el llamador no lo mandó**; los demás viajan sólo
si venían. Una cabecera ausente o vacía se omite: un `x-user-id` vacío aguas
abajo se lee como "hay un usuario y no tiene id", que es peor que no decir nada.

El id se devuelve además en la respuesta, para que el llamador pueda reportar una
falla citándolo. Un navegador sólo puede leerlo porque la política de CORS expone
esa cabecera.

## Redacción de logs

```ts
LoggerModule.forRoot(
  createRequestLoggerOptions({
    level: process.env.LOG_LEVEL,
    requestId: () => context.requestId(),
  }),
);
```

Devuelve las opciones que espera `nestjs-pino`, **sin importarlo**: `pino` y
`nestjs-pino` quedan opcionales y el paquete instala sin ninguna dependencia de
logging.

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
