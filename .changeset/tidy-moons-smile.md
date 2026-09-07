---
'@ahincho/nova-nestjs-schematics': patch
---

El servicio generado ahora **documenta sus endpoints**, que era la mitad que faltaba de la
funcionalidad publicada en 0.12.0.

`ApiEnvelope` recibe una clase, y los dos DTO de respuesta que emitía el generador -el del ACL y el
del BFF- eran `type`. OpenAPI se genera leyendo metadatos en tiempo de ejecución y un `type` de
TypeScript no deja ninguno, así que **no se podía documentar nada de lo que salía del generador**.
Ahora son clases con `@ApiProperty`, y los dos controladores llevan `@ApiEnvelope` y `ApiErrors`.

La diferencia se ve en el documento que sirve un servicio recién generado:

```jsonc
// antes                        // ahora
"schemas": [                    "schemas": [
  "ApiEnvelopeSchema",            "ApiEnvelopeSchema",
  "ApiErrorItemSchema"            "ApiErrorItemSchema",
]                                 "BuildingsResponse"
                                ]
"/api/v1/buildings/{id}":       "200": allOf [ApiEnvelopeSchema,
  (sin esquema)                            { data: BuildingsResponse }]
                                "404": NOT_FOUND
```

Su prueba de punta a punta lo verifica: que el documento se sirva no alcanza, porque un endpoint sin
esquema sale con el documento igual de verde.
