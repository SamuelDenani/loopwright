import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    reporters: ['default'],
    coverage: {
      provider: 'v8',
      // json-summary feeds the quality gate; the others are for humans and artifacts.
      reporter: ['text', 'json-summary', 'html', 'lcov'],
      reportsDirectory: 'coverage',
      include: ['src/**/*.ts'],
      // Barrel files and type-only declarations compile away to nothing.
      exclude: ['src/**/*.d.ts', 'src/**/index.ts'],
    },
  },
});
