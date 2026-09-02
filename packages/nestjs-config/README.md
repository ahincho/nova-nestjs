# @ahincho/nova-nestjs-config

Lectores tipados de variables de entorno, declaración de upstreams y política de
CORS para servicios NestJS de Nova Platform.

```bash
pnpm add @ahincho/nova-nestjs-config @nestjs/config
```

## Declarar un upstream

Es la pieza que más paga. Una línea reemplaza el archivo de configuración que
cada servicio copiaba por upstream:

```ts
import { defineUpstream } from '@ahincho/nova-nestjs-config';

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
} from '@ahincho/nova-nestjs-config';

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

## CORS

```ts
import { buildCorsOptions } from '@ahincho/nova-nestjs-config';

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

`validationSchema` se pasa tal cual a `@nestjs/config`, que espera un esquema de
Joi. **La plataforma no depende de Joi**: una aplicación que prefiera otro
validador lo omite y valida dentro de sus propios namespaces.
