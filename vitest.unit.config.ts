import { defineConfig } from 'vitest/config'

/** Unit tests only — no DynamoDB globalSetup (safe when docker is down). */
export default defineConfig({
  test: {
    include: ['test/**/*.unit.spec.ts'],
    pool: 'forks',
    maxWorkers: 1,
    minWorkers: 1,
    fileParallelism: false,
    testTimeout: 30_000,
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: [
        'src/**/*.d.ts',
        'src/types.ts',
        'src/transactions/types.ts',
        'src/exports/migration-utils.ts',
      ],
      reportsDirectory: './coverage',
      reporter: ['text', 'text-summary'],
      thresholds: {
        lines: 95,
        functions: 95,
        statements: 95,
        branches: 95,
      },
    },
  },
})
