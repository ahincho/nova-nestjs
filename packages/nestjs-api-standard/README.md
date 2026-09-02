# @nova-platform/nestjs-api-standard

Integración con NestJS del sobre de respuesta de Nova Platform. Registra un
interceptor y un filtro globales para que ningún controlador arme el sobre a mano.

```bash
pnpm add @nova-platform/nestjs-api-standard
```

## Activación

En NestJS **nada se activa solo**: no hay escaneo de classpath como en Spring Boot,
así que la activación es una llamada explícita.

```ts
import { ApiStandardModule } from '@nova-platform/nestjs-api-standard';

@Module({
  imports: [ApiStandardModule.forRoot()],
})
export class AppModule {}
```

Con eso, un controlador devuelve su objeto de dominio:

```ts
@Get(':id')
findOne(@Param('id') id: string) {
  return this.service.findOne(id);   // -> { success: true, status: 200, data: {...}, errors: [] }
}
```

## Errores de validación

```ts
import { validationExceptionFactory } from '@nova-platform/nestjs-api-standard';

app.useGlobalPipes(
  new ValidationPipe({
    whitelist: true,
    transform: true,
    exceptionFactory: validationExceptionFactory,
  }),
);
```

Cada restricción incumplida viaja como una entrada con su campo, y un DTO anidado
se aplana con ruta punteada (`address.zipCode`) para que el formulario pueda
resaltar el input exacto.

## Dejar una ruta fuera del sobre

```ts
@SkipResponseWrapper()
@Get('live')
live() {
  return { status: 'ok' };
}
```

Las sondas de salud son el motivo de que exista: el balanceador revisa la **forma**
del cuerpo, y envolverlo lo convierte en `{ data: { status: 'ok' } }`. El status
sigue siendo 200, así que el target group sigue pasando y nada delata el cambio.

## Opciones

| Opción                 | Por defecto               | Para qué                       |
| ---------------------- | ------------------------- | ------------------------------ |
| `wrapResponses`        | `true`                    | registra el interceptor global |
| `catchExceptions`      | `true`                    | registra el filtro global      |
| `internalErrorMessage` | `'Internal server error'` | mensaje de todo 5xx            |

## Dos decisiones que conviene conocer

**Ningún 5xx llega con su mensaje real.** `connect ECONNREFUSED 10.0.3.14:5432`
va al log; el cliente recibe el mensaje genérico. Distinguir un 502 de un 504 le
cuenta al llamador cómo está armada la topología.

**Un 4xx se registra como `warn`, no como `error`.** El 4xx es el cliente
equivocándose, no una falla nuestra; registrarlo como error entierra los 5xx que
sí importan.

El filtro escribe con el `Logger` de Nest, así que si la aplicación instaló pino
con `app.useLogger()`, estas entradas salen en ese formato. El paquete no depende
de ninguna librería de logging.
