/// <reference types="vitest/config" />
import { defineConfig } from 'vitest/config';

export default defineConfig({
  base: '/web_toys/battleship/',
  build: { target: 'es2022' },
  worker: { format: 'es' },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
