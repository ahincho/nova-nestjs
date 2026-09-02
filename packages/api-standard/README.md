# @nova-platform/api-standard

Sobre de respuesta HTTP de Nova Platform. TypeScript puro, **cero dependencias**:
lo consume NestJS, pero también un Lambda o un script.

```bash
pnpm add @nova-platform/api-standard
```

## El contrato

```ts
type ApiResponse<T> = {
  success: boolean;
  status: number;
  data: T | null;
  errors: readonly ApiErrorItem[];
};

type ApiErrorItem = {
  code: string;
  message: string;
  field: string | null;
};
```

`data` y `errors` son excluyentes por construcción: un éxito lleva `errors` vacío,
un fallo lleva `data: null`.

## Uso

```ts
import { ApiResponses, errorItem } from '@nova-platform/api-standard';

ApiResponses.ok({ id: 7 }); // 200
ApiResponses.created({ id: 7 }); // 201
ApiResponses.errorOf(404, 'Alumno no encontrado'); // code: NOT_FOUND
ApiResponses.error(400, ...validationErrors);
```

`errorOf` deriva el `code` del status HTTP, y `options.code` lo sobrescribe cuando
el dominio tiene un código propio (`ALREADY_ENROLLED`).

## Por qué el cliente ramifica por `code` y no por `status`

El `code` sobrevive a un cambio de transporte. Y **todo 5xx colapsa a
`INTERNAL_SERVER_ERROR`** a propósito: distinguir un 502 de un 504 le cuenta al
llamador cómo está armada la topología por dentro.

## Nada construye el sobre a mano

`ApiResponses` es el único lugar autorizado a crear el objeto. Un literal suelto
es lo que permite que viaje un `success: true` con `errors` lleno, que ningún
consumidor sabe leer.
