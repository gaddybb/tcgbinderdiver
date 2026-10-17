import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist', 'reference'] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ['**/*.{ts,tsx}'],
    languageOptions: { ecmaVersion: 2022, globals: globals.browser },
    plugins: { 'react-hooks': reactHooks },
    rules: { ...reactHooks.configs.recommended.rules },
  },
  {
    // src/core stays pure: no React, no fetch, no clock reads (pass `now` in).
    files: ['src/core/**/*.ts'],
    ignores: ['src/core/**/*.test.ts'],
    rules: {
      'no-restricted-imports': ['error', { patterns: ['react', 'react-*', '../app/*', '../connectors/*', '../storage/*'] }],
      'no-restricted-globals': ['error', 'fetch', 'window', 'document', 'localStorage', 'indexedDB'],
      'no-restricted-syntax': ['error',
        { selector: "CallExpression[callee.object.name='Date'][callee.property.name='now']", message: 'Pass `now` in.' },
        { selector: "NewExpression[callee.name='Date'][arguments.length=0]", message: 'Pass `now` in.' }],
    },
  },
);
