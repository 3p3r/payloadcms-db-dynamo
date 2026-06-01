import { defineConfig, devices } from '@playwright/test'

import { MAX_MS } from './test/e2e/constants.js'

const CI = Boolean(process.env.CI)

export default defineConfig({
  testDir: 'test/e2e',
  fullyParallel: false,
  forbidOnly: CI,
  retries: CI ? 1 : 0,
  workers: 1,
  timeout: MAX_MS,
  expect: { timeout: MAX_MS },
  globalSetup: './test/e2e/global-setup.ts',
  reporter: CI ? [['github'], ['list']] : [['list']],
  use: {
    trace: CI ? 'on-first-retry' : 'off',
    screenshot: 'only-on-failure',
    actionTimeout: MAX_MS,
    navigationTimeout: MAX_MS,
  },
  projects: [
    {
      name: 'setup-payload-3',
      testMatch: 'payload-3.auth.setup.ts',
      use: {
        ...devices['Desktop Chrome'],
        baseURL: 'http://127.0.0.1:3000',
      },
    },
    {
      name: 'payload-3',
      testMatch: 'payload-3.kitchen-sink.spec.ts',
      dependencies: ['setup-payload-3'],
      use: {
        ...devices['Desktop Chrome'],
        baseURL: 'http://127.0.0.1:3000',
      },
    },
    {
      name: 'setup-payload-4',
      testMatch: 'payload-4.auth.setup.ts',
      use: {
        ...devices['Desktop Chrome'],
        baseURL: 'http://127.0.0.1:3001',
      },
    },
    {
      name: 'payload-4',
      testMatch: 'payload-4.kitchen-sink.spec.ts',
      dependencies: ['setup-payload-4'],
      use: {
        ...devices['Desktop Chrome'],
        baseURL: 'http://127.0.0.1:3001',
      },
    },
  ],
  webServer: [
    {
      command: 'npm run dev --prefix examples/payload-3.x',
      url: 'http://127.0.0.1:3000/admin',
      reuseExistingServer: !CI,
      timeout: MAX_MS,
    },
    {
      command: 'npm run dev --prefix examples/payload-4.x',
      url: 'http://127.0.0.1:3001/admin',
      reuseExistingServer: !CI,
      timeout: MAX_MS,
    },
  ],
})
