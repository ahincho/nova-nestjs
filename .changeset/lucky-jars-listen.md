---
'@nova-platform/nestjs-config': minor
'@nova-platform/nestjs-http': minor
---

Configuración y cliente HTTP de salida.

- `nestjs-config`: `defineUpstream()`, que declara un upstream en una línea y
  hace fallar el arranque cuando su URL nunca se inyectó; lectores tipados de
  variables de entorno; y la política de CORS, que falla cerrada.
- `nestjs-http`: `HttpClientService` sobre el `fetch` global, con timeout
  siempre puesto, propagación de cabeceras de correlación por un puerto
  inyectado, error de upstream opaco salvo que el llamador pida lo contrario, y
  logs sin cuerpo ni query string.
