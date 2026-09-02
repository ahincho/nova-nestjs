# @ahincho/nova-eslint-config

Configuración plana de ESLint compartida por los proyectos NestJS de Nova Platform.

```bash
pnpm add -D @ahincho/nova-eslint-config eslint
```

```js
// eslint.config.mjs
import nova from '@ahincho/nova-eslint-config';
export default nova;
```

Para agregar reglas propias sin perder las de la plataforma:

```js
import nova from '@ahincho/nova-eslint-config';
export default [...nova, { rules: { 'no-console': 'error' } }];
```

Parte de `recommendedTypeChecked`. Las tres desviaciones están comentadas en el
archivo con su motivo; la que más importa es `no-explicit-any` en `error`, porque
en un BFF un `any` viaja desde la respuesta del upstream hasta el controlador sin
que nadie lo note.
