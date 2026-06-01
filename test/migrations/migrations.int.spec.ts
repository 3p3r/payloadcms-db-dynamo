import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { initPayloadTest, type TestHandle } from '../__helpers/initPayload.js'
import { config } from './config.js'

const migrationDir = join(dirname(fileURLToPath(import.meta.url)), '../fixtures/empty-migrations')

let handle: TestHandle

beforeAll(async () => {
  handle = await initPayloadTest('migrations', config, { migrationDir })
})

afterAll(async () => {
  await handle?.cleanup()
})

describe('migrations', () => {
  it('migrateStatus runs without error', async () => {
    await expect(handle.payload.db.migrateStatus()).resolves.toBeUndefined()
  })

  it('migrate runs with empty migration dir', async () => {
    await expect(handle.payload.db.migrate()).resolves.toBeUndefined()
  })

  it('migrateDown and migrateReset are callable', async () => {
    const db = handle.payload.db
    await expect(db.migrateDown()).resolves.toBeUndefined()
    await expect(db.migrateReset()).resolves.toBeUndefined()
  })
})
