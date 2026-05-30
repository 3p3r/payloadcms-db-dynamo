import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import type { DynamoAdapter } from '../../src/index.js'

import { initPayloadTest, type TestHandle } from '../__helpers/initPayload.js'
import { config } from './config.js'

let handle: TestHandle
let adapter: DynamoAdapter

beforeAll(async () => {
  handle = await initPayloadTest('jobs', config)
  adapter = handle.payload.db as DynamoAdapter
})

afterAll(async () => {
  await handle?.cleanup()
})

describe('updateJobs (default createDatabaseAdapter)', () => {
  it('is callable against DynamoDB', async () => {
    expect(adapter.updateJobs).toBeTypeOf('function')
    const result = await adapter.updateJobs({
      where: { completedAt: { exists: false } },
      data: {},
    })
    expect(result).toEqual([])
  })
})
