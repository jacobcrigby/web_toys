/// <reference types="vitest/config" />
import { defineConfig } from 'vitest/config';

export default defineConfig({
  base: '/web_toys/daylight-map/',
  build: { target: 'es2022' },
  optimizeDeps: { include: ['@photostructure/tz-lookup'] },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
