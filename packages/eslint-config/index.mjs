import tseslint from 'typescript-eslint';

/**
 * Configuracion plana de ESLint compartida por los proyectos de Nova Platform.
 *
 *   // eslint.config.mjs
 *   import nova from '@nova-platform/eslint-config';
 *   export default nova;
 *
 * Para agregar reglas propias sin perder las de la plataforma:
 *
 *   export default [...nova, { rules: { 'no-console': 'error' } }];
 */
export default tseslint.config(
  {
    ignores: [
      'dist/**',
      'coverage/**',
      'node_modules/**',
      '**/*.mjs',
      '**/*.js',
    ],
  },
  ...tseslint.configs.recommendedTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
      },
    },
    rules: {
      // Un puerto o un DTO se declaran como tipo vacio a proposito mientras el
      // contrato del upstream todavia no esta cerrado.
      '@typescript-eslint/no-empty-interface': 'off',

      // El parametro sin usar se marca con guion bajo: eso hace explicito que
      // la firma la impone una interfaz de Nest y no un descuido.
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],

      // `any` es error, no aviso: en un BFF el `any` viaja desde la respuesta
      // del upstream hasta el controlador sin que nadie lo note.
      '@typescript-eslint/no-explicit-any': 'error',
    },
  },
  {
    files: ['**/*.spec.ts'],
    rules: {
      // Un test arma dobles parciales a proposito.
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off',
    },
  },
);
