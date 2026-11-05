import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['functions/**/*.test.ts'],
    // Worker endpoints arrive in later tasks; an empty suite is explicit for now.
    passWithNoTests: true,
  },
});
