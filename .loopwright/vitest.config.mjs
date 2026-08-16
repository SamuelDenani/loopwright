import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.mjs'],
    reporters: ['default', 'json'],
    outputFile: { json: 'reports/test-results.json' },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json-summary'],
      reportsDirectory: 'reports/coverage',
      include: ['scripts/**/*.mjs'],
    },
  },
});
