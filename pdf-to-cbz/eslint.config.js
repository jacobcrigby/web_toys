// SPDX-License-Identifier: Apache-2.0
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettier from 'eslint-config-prettier';

export default tseslint.config(
  { ignores: ['dist', 'coverage', 'node_modules'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  // Build-time Node scripts (icon generation) run under Node, not the browser.
  {
    files: ['scripts/**/*.mjs'],
    languageOptions: { globals: { Buffer: 'readonly', console: 'readonly' } },
  },
  prettier,
);
