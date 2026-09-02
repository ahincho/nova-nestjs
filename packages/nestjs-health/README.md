# @nova-platform/nestjs-health

Sondas de vida y de disponibilidad para servicios NestJS de Nova Platform.

```bash
pnpm add @nova-platform/nestjs-health
```

```ts
@Module({
  imports: [
    NovaHealthModule.forRoot({
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

Sirve `GET /health/live` y `GET /health/ready`.

## Vida y disponibilidad no son lo mismo

**`/health/live` responde sin tocar ninguna dependencia.** Una sonda de vida que
falla porque la base de datos está caída consigue que reinicien el contenedor, y
eso no levanta la base de datos.

**`/health/ready` corre los chequeos registrados** y responde 503 si alguno falla.
Los corre en paralelo, y **cada uno tiene fecha límite** (2 s por defecto): una
sonda que nunca contesta es peor que una que dice "no estoy lista", porque el
balanceador espera su propio timeout en cada intento. Un chequeo que lanza cuenta
como fallado; no hace falta que se proteja solo.

```json
{ "status": "error", "checks": { "database": true, "cache": false } }
```

## Dos detalles que evitan un despliegue muerto

**El controlador está exento del sobre de respuesta.** El balanceador revisa la
**forma** del cuerpo, y envolverlo lo convierte en `{ data: { status: 'ok' } }`
mientras el status sigue en 200 — así que nada delata el cambio hasta que una
sonda empieza a fallar.

**Mover `path` es mover el target group.** Una sonda que responde 404 hace que la
tarea se desregistre unos nueve segundos después de registrarse, y el despliegue
muere diez minutos más tarde con un timeout que se lee como un problema de
recursos. Si usas `globalPrefix`, `bootstrap()` de `@nova-platform/nestjs` deja
las sondas fuera del prefijo por esta misma razón.

## Opciones

| Opción            | Por defecto | Para qué                     |
| ----------------- | ----------- | ---------------------------- |
| `path`            | `'health'`  | prefijo de las rutas         |
| `readinessChecks` | `[]`        | de qué depende estar listo   |
| `checkTimeoutMs`  | `2000`      | fecha límite de cada chequeo |
