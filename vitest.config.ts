import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['test/**/*.int.spec.ts', 'test/**/*.unit.spec.ts'],
    globalSetup: ['test/__helpers/globalSetup.ts'],
    pool: 'forks',
    // One worker: each integration file boots a full Payload instance; parallel
    // forks routinely OOM WSL when coverage instrumentation is enabled.
    maxWorkers: 1,
    minWorkers: 1,
    fileParallelism: false,
    testTimeout: 60_000,
    hookTimeout: 60_000,
    reporters: ['default'],
    sequence: {
      concurrent: false,
    },
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
      reporter: ['text', 'text-summary', 'lcov'],
      thresholds: {
        lines: 95,
        functions: 95,
        statements: 95,
        branches: 95,
      },
    },
  },
})
