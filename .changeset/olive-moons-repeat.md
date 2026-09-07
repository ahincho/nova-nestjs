---
'@ahincho/nova-nestjs': patch
---

El release empuja sus tags, y falla si no publicó nada.

Dos defectos del workflow de release que salieron al publicar la 0.14.0:

- **`git push --follow-tags` sólo empuja tags anotados**, y los que crea changesets son
  lightweight. El paso decía «Everything up-to-date» y no subía ninguno, así que se publicaron
  veintiún versiones sin que quedara en git una sola marca de qué commit produjo cada una. Se
  recuperaron los 55 tags a partir del SHA de cada corrida de release.
- **Una corrida podía publicar nada y quedar verde.** `changeset publish` publica lo que dicen
  los manifiestos: sin el commit de `version-packages` en la rama, termina bien sin subir nada.
  Pasó seis veces. Ahora el paso compara los tags de HEAD antes y después, y corta si no
  apareció ninguno.
