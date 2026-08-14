import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: ['node_modules/**', 'coverage/**', 'reports/**', 'dist/**'],
  },

  js.configs.recommended,
  ...tseslint.configs.recommended,

  // Application source: the strict tier.
  {
    files: ['src/**/*.ts'],
    languageOptions: {
      parserOptions: { ecmaVersion: 2022, sourceType: 'module' },
    },
    rules: {
      // --- shape guardrails: keep units small enough to review and to test ---
      complexity: ['warn', { max: 10 }],
      'max-depth': ['warn', 4],
      'max-params': ['warn', 5],
      'max-lines-per-function': ['warn', { max: 60, skipBlankLines: true, skipComments: true }],
      'max-nested-callbacks': ['warn', 3],

      // --- escape-hatch guardrails: the things an agent reaches for when stuck ---
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-non-null-assertion': 'error',
      '@typescript-eslint/ban-ts-comment': [
        'error',
        { 'ts-ignore': true, 'ts-expect-error': 'allow-with-description', 'ts-nocheck': true },
      ],
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],

      // --- silent-failure guardrails ---
      'no-empty': ['error', { allowEmptyCatch: false }],
      'no-console': 'error',
      'no-alert': 'error',
      eqeqeq: ['error', 'always', { null: 'ignore' }],
      'no-return-await': 'error',
      'require-atomic-updates': 'error',
      'no-fallthrough': 'error',
    },
  },

  // Tests: same escape-hatch rules, relaxed shape rules.
  {
    files: ['tests/**/*.ts'],
    languageOptions: {
      globals: { ...globals.node },
      parserOptions: { ecmaVersion: 2022, sourceType: 'module' },
    },
    rules: {
      'max-lines-per-function': 'off',
      'max-nested-callbacks': 'off',
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-non-null-assertion': 'warn',
    },
  },

  // Gate tooling runs on Node, outside the TS project.
  {
    files: ['scripts/**/*.mjs', '*.js'],
    languageOptions: {
      globals: { ...globals.node },
      parserOptions: { ecmaVersion: 2022, sourceType: 'module' },
    },
    rules: {
      'no-console': 'off',
      complexity: ['warn', { max: 14 }],
    },
  },
);
