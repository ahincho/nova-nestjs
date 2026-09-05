# auth

Autenticación por JWT para servicios NestJS de Nova Platform. **Es opcional**:
omitirla deja el servicio como estaba.

```ts
@Module({
  imports: [
    NovaModule.forRoot({
      auth: { preferredRoles: ['student'] },
    }),
  ],
})
export class AppModule {}
```

Con eso, cada ruta del servicio exige un `Authorization: Bearer <jwt>` y el
controlador recibe quién llama:

```ts
@Get('me')
me(@CurrentUser() user: Principal): Profile {
  return this.profiles.of(user.id);
}
```

## Lo primero: acá no se verifica ninguna firma

Por defecto el guard **lee los claims del token tal como vino**. No comprueba la
firma, ni la expiración, ni el emisor.

Eso es correcto en una sola topología, que además es la común: un API Gateway o
un sidecar delante del servicio ya validó el token y rechazó el inválido antes
de que la petición llegara. Repetir la verificación ahí cuesta una llamada al
emisor por petición y no agrega nada.

**En cualquier otra topología no alcanza**, porque un token sin verificar lo
escribe cualquiera con una consola de navegador. Si el servicio se expone
directo, la verificación va en `verify`:

```ts
auth: {
  verify: async (token) => jwtVerify(token, jwks, { issuer, audience }),
}
```

Devuelve los claims o lanza. Cómo falle da igual: firma, expiración o emisor
salen todos como un 401 pelado, porque decir cuál de las tres falló le sirve
sobre todo a quien está probando tokens.

## Todo protegido, lo público se declara

El guard queda global. No es una preferencia: es la única forma de que una ruta
nueva no nazca abierta porque nadie se acordó de decorarla.

```ts
@Public()
@Get('version')
version(): { version: string } {
  return { version: '1.0.0' };
}
```

`@Public()` vale sobre un método o sobre un controlador entero. **Las sondas de
salud ya lo traen**: si dependieran de un token, el balanceador las vería en 401
y desregistraría una tarea perfectamente sana.

## Quién llama

```ts
type Principal = {
  readonly id: string;
  readonly role: string;
  readonly claims: JwtClaims;
};
```

`claims` queda entero para lo que la aplicación necesite y la plataforma no
conoce: un `email`, un `campus`, lo que el emisor ponga.

### El identificador

Sale de `preferred_username` y se normaliza sin espacios, sin la arroba inicial
y en mayúsculas, así el mismo usuario es la misma cadena en todos los logs.

A propósito no sale de `sub`. `sub` es el identificador interno del emisor: no
le sirve a nadie aguas abajo, no aparece en ninguna base de datos del negocio, y
cambia si el usuario se recrea.

| Claim            | Principal        |
| ---------------- | ---------------- |
| `@u12345`        | `U12345`         |
| `  U12345  `     | `U12345`         |
| `ana@utp.edu.pe` | `ANA@UTP.EDU.PE` |

La arroba del medio se queda: recortarla inventaría un identificador que no
existe. Se cambia entero con `idClaim` y `normalizeId`.

### El rol

Sale de `realm_access.roles`, que es donde lo pone Keycloak, y se resuelve así:

1. Se descartan los roles que describen lo que el token puede hacer y no quién
   lo trae: `offline_access`, `uma_authorization` y todo lo que empiece con
   `default-roles-`.
2. Si queda alguno de `preferredRoles`, gana, venga en la posición que venga.
3. Si no, gana el primero que quedó.
4. Si no quedó ninguno, es un 401.

El rol devuelto es **el que está en `preferredRoles`**, no el que escribió el
emisor: la aplicación compara contra una cadena estable y no contra `STUDENT`
una vez y `student` la siguiente.

Un token sin identificador o sin un rol utilizable no describe a nadie. Dejarlo
pasar es peor que rechazarlo, porque el servicio termina autorizando contra un
`undefined`.

## El identificador viaja solo

Cuando el módulo de observabilidad está activo -lo está con `NovaModule`-, el
guard agrega el identificador al contexto de la petición. Desde ahí sale como
`x-user-id` en cada llamada a un upstream, sin que ningún punto de llamada lo
pase:

```ts
// El cliente HTTP no sabe que hay un usuario; la cabecera sale igual.
await this.academic.get('/courses');
```

Se cambia con `userIdHeader`. Sin el módulo de observabilidad el guard sigue
autenticando, y lo único que se pierde es esa propagación.

## Opciones

| Opción                | Por defecto                           | Para qué                                   |
| --------------------- | ------------------------------------- | ------------------------------------------ |
| `idClaim`             | `preferred_username`                  | de qué claim sale el identificador         |
| `normalizeId`         | sin arroba inicial, en mayúsculas     | cómo se normaliza                          |
| `rolesClaim`          | `realm_access.roles`                  | ruta con puntos hacia el arreglo de roles  |
| `preferredRoles`      | `[]`                                  | cuál gana si hay varios                    |
| `ignoredRoles`        | `offline_access`, `uma_authorization` | los que nunca describen a un usuario       |
| `ignoredRolePrefixes` | `default-roles-`                      | prefijos con el mismo trato                |
| `userIdHeader`        | `x-user-id`                           | con qué cabecera viaja hacia los upstreams |
| `verify`              | ninguna                               | comprobación real de la firma              |

## Autorizar es otra cosa

Este módulo responde **quién llama**, no **qué puede hacer**. Un guard de roles
por ruta, o un chequeo de pertenencia contra el dominio, se escriben en la
aplicación: dependen de reglas de negocio que la plataforma no conoce y que
cambian por servicio.

Lo que sí queda resuelto acá es que ese guard reciba un `Principal` ya
normalizado, en vez de que cada servicio vuelva a decidir de qué claim sale el
código del usuario.
