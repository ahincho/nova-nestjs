---
'@ahincho/nova-nestjs-toolchain': patch
---

El preset de TypeScript escribe el archivo de estado incremental **dentro del
`outDir`**, con `tsBuildInfoFile: "${configDir}/dist/tsconfig.tsbuildinfo"`.

Por defecto queda al lado del `tsconfig`, o sea fuera de `dist`, y entonces los
dos pueden contradecirse. Cualquier cosa que borre `dist` sin borrarlo -el
`deleteOutDir` de nest-cli, un `rimraf`, alguien a mano- deja el estado
afirmando que ya está todo compilado: **`nest build` no emite nada y termina
con éxito**, y el fallo aparece recién en el contenedor, como un
`MODULE_NOT_FOUND` sobre `dist/main.js`.

Reproducido en el servicio de ejemplo y en los paquetes de este repositorio.
Adentro del `outDir` se borran juntos y no pueden discrepar.
