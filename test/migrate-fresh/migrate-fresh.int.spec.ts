import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import type { DynamoAdapter } from '../../src/index.js'

import { initPayloadTest, type TestHandle } from '../__helpers/initPayload.js'
import { config } from './config.js'

const migrationDir = join(dirname(fileURLToPath(import.meta.url)), '../fixtures/migrations')

let handle: TestHandle

beforeAll(async () => {
  handle = await initPayloadTest('migrate-fresh', config, { migrationDir })
})

afterAll(async () => {
  await handle?.cleanup()
})

describe('migrateFresh', () => {
  it('recreates the table and runs migrations when forced', async () => {
    const adapter = handle.payload.db as DynamoAdapter
    await adapter.create({ collection: 'items', data: { label: 'before' } })
    await expect(
      adapter.migrateFresh?.({ forceAcceptWarning: true }),
    ).resolves.toBeUndefined()
    const count = await adapter.count({ collection: 'items' })
    expect(count.totalDocs).toBe(1)
    const found = await adapter.findOne({
      collection: 'items',
      where: { label: { equals: 'migrated' } },
    })
    expect(found?.label).toBe('migrated')
  })
})
