---
'@ahincho/nova-nestjs': minor
---

Las sondas de salud corren sobre `@nestjs/terminus`, que pasa a ser peer
dependency. `ready` responde con el cuerpo estándar de terminus
(`status`, `info`, `error`, `details`) y acepta indicadores nativos por
`readinessIndicators` junto a los `readinessChecks` de siempre. Entran
`legacyPath`, para la ruta que un target group ya existente revisa, y
`gracefulShutdownTimeoutMs`, la ventana en que el servicio responde 503 con
`status: 'shutting_down'` tras SIGTERM antes de cerrar. `bootstrap()` activa
los hooks de apagado y deja la ruta heredada fuera de `globalPrefix`.

Node mínimo pasa a 24.9: terminus 12 es ESM puro y es la versión desde la que
Jest puede cargarlo con `require(esm)`; en runtime Node lo carga desde 22.12,
pero la plataforma se prueba y despliega en 24.
