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
  Es lo que evita los errores de los últimos segundos de cada despliegue.
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

## Opciones

| Opción                      | Por defecto | Para qué                                                    |
| --------------------------- | ----------- | ----------------------------------------------------------- |
| `path`                      | `'health'`  | prefijo de las rutas                                        |
| `legacyPath`                | —           | ruta heredada que un target group ya revisa                 |
| `readinessChecks`           | `[]`        | de qué depende estar listo, en la forma corta               |
| `readinessIndicators`       | `[]`        | indicadores nativos de terminus                             |
| `checkTimeoutMs`            | `2000`      | fecha límite de cada chequeo                                |
| `gracefulShutdownTimeoutMs` | `0`         | cuánto sigue respondiendo 503 antes de cerrar, tras SIGTERM |
