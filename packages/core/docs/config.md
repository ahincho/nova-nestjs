# config

Lectores tipados de variables de entorno, declaración de upstreams y política de
CORS para servicios NestJS de Nova Platform.

```bash
pnpm add @ahincho/nova-nestjs
```

## Declarar un upstream

Es la pieza que más paga. Una línea reemplaza el archivo de configuración que
cada servicio copiaba por upstream:

```ts
import { defineUpstream } from '@ahincho/nova-nestjs';

export const academicOrchestrator = defineUpstream('academic-orchestrator');
// lee ACADEMIC_ORCHESTRATOR_URL y ACADEMIC_ORCHESTRATOR_TIMEOUT_MS
```

```ts
@Module({
  imports: [ConfigModule.forFeature(academicOrchestrator)],
})
export class AcademicOrchestratorModule {}
```

```ts
constructor(
  @Inject(academicOrchestrator.KEY)
  private readonly config: ConfigType<typeof academicOrchestrator>,
) {}
// config.url, config.timeoutMs
```

**El servicio muere al arrancar si la URL nunca se inyectó**, nombrando la
variable. Sin eso, la variable faltante sobrevive a un despliegue verde y aparece
como un 500 la primera vez que alguien llama esa ruta, semanas después.

El nombre acepta kebab-case, camelCase y snake_case; los tres derivan el mismo
prefijo. Si la variable no sigue el nombre, `envPrefix` lo dice explícito.

## Leer variables

```ts
import {
  requireEnv,
  optionalEnv,
  numberEnv,
  booleanEnv,
  urlEnv,
} from '@ahincho/nova-nestjs';

requireEnv('SERVICE_NAME'); // falla si falta o está en blanco
optionalEnv('LOG_LEVEL', 'info');
numberEnv('PORT', 3000); // falla si no es un número, y dice cuál era
booleanEnv('LOG_PRETTY', false); // true/false, 1/0, yes/no
urlEnv('ACADEMIC_ORCHESTRATOR_URL'); // http(s), sin barra final
```

Todos lanzan `EnvironmentError` nombrando la variable. Tres detalles que evitan
una investigación:

- **Un valor en blanco cuenta como faltante.** Es lo que produce una task
  definition con el campo vacío, y tratarlo como presente convierte un error de
  configuración en una falla en otro lado.
- **`numberEnv` reporta el texto que encontró.** `Number('8080abc')` es `NaN` y
  `Number('')` es `0`: sin el texto, un timeout en cero no se explica.
- **`urlEnv` quita la barra final.** `${base}/path` con barra final produce una
  doble barra, y algunos gateways la enrutan a una regla distinta de la probada.

## El ambiente

```ts
import { appEnvironment } from '@ahincho/nova-nestjs';

appEnvironment(); // 'dev' | 'qa' | 'prod', leído de APP_ENV
```

Existe para que **una sola imagen sirva para los tres ambientes**. El artefacto
que se probó en dev es el que llega a prod, byte por byte; construir uno por
ambiente significa que lo que se aprobó no es lo que se despliega.

**No tiene valor por defecto, y eso es el punto.** Un contenedor sin `APP_ENV`
no arranca, y el error nombra la variable:

```
EnvironmentError: Environment variable APP_ENV is required but was not set
```

Con un valor por defecto, el que se olvidó de inyectarla en prod arranca
creyéndose otra cosa, y eso no se descubre hasta que alguien nota que la
documentación está publicada donde no debía. Un valor en blanco -lo que produce
una task definition a la que le dejaron el campo vacío- cuenta como ausente.

### No es `NODE_ENV`

Confundirlos es el error que esto existe para evitar.

|            | Qué dice                         | Dónde se fija                       |
| ---------- | -------------------------------- | ----------------------------------- |
| `NODE_ENV` | si el artefacto es de producción | en la imagen, siempre `production`  |
| `APP_ENV`  | dónde está corriendo             | en la task definition, por ambiente |

`NODE_ENV=production` vale igual corriendo en dev: le habla a Node y a las
librerías, no al despliegue.

## CORS

```ts
import { buildCorsOptions } from '@ahincho/nova-nestjs';

app.enableCors(
  buildCorsOptions({ origins: process.env.CORS_ALLOWED_ORIGINS ?? '' }),
);
```

La lista es toda la política: sin ramas por ambiente y sin loopback implícito.
**Una lista vacía no permite ningún origen**, así que un contenedor que nadie
configuró falla cerrado. Las credenciales quedan en `false` a propósito: la
autenticación viaja en `Authorization`, y credenciales más origen reflejado es la
combinación que filtra una sesión.

## Módulo

```ts
@Module({
  imports: [NovaConfigModule.forRoot({ load: [academicOrchestrator] })],
})
export class AppModule {}
```

Envoltorio delgado sobre `ConfigModule.forRoot()` que fija las dos opciones que
todos los servicios ponían igual: global, y con `expandVariables` para poder
expandir un secreto inyectado como un único JSON. Es `async` porque el de Nest lo
es; Nest acepta una promesa en `imports`, así que la llamada no cambia.

`validationSchema` se pasa tal cual a `@nestjs/config`. **Desde la versión 12
espera un esquema [Standard Schema](https://standardschema.dev/) -Zod, Arktype,
valibot-, no uno de Joi**, y ese es el cambio incompatible de subir a NestJS 12:
un servicio que traía un esquema de Joi tiene que cambiarlo.

La plataforma no depende de ninguno de los dos. Un servicio que no quiera sumar
una librería tiene dos salidas: omitirlo y validar dentro de sus propios
namespaces, o pasarle `validate` a `ConfigModule` directamente, que es una
función `(config) => config` y no necesita nada instalado.
