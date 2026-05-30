import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import type { DynamoAdapter } from '../../src/index.js'

import { initPayloadTest, type TestHandle } from '../__helpers/initPayload.js'
import { config } from './config.js'

let handle: TestHandle
let adapter: DynamoAdapter

beforeAll(async () => {
  handle = await initPayloadTest('adapter-interface', config)
  adapter = handle.payload.db as DynamoAdapter
})

afterAll(async () => {
  await handle?.cleanup()
})

describe('BaseDatabaseAdapter surface', () => {
  it('exposes adapter metadata', () => {
    expect(adapter.name).toBe('dynamodb')
    expect(adapter.packageName).toBe('@payloadcms/db-dynamodb')
    expect(adapter.defaultIDType).toBe('text')
    expect(adapter.migrationDir).toBeTruthy()
  })

  it('implements CRUD and globals', async () => {
    const created = await adapter.create({
      collection: 'items',
      data: { label: 'a' },
    })
    expect(created.id).toBeTruthy()

    const found = await adapter.findOne({
      collection: 'items',
      where: { id: { equals: created.id } },
    })
    expect(found?.label).toBe('a')

    const count = await adapter.count({ collection: 'items' })
    expect(count.totalDocs).toBeGreaterThan(0)

    await adapter.updateOne({
      collection: 'items',
      id: created.id,
      data: { label: 'b' },
    })

    await adapter.deleteOne({
      collection: 'items',
      where: { id: { equals: created.id } },
    })
  })

  it('implements globals', async () => {
    await adapter.createGlobal({ slug: 'site', data: { title: 'T' } })
    const g = await adapter.findGlobal({ slug: 'site' })
    expect(g?.title).toBe('T')
    await adapter.updateGlobal({ slug: 'site', data: { title: 'T2' } })
  })

  it('implements generateSchema', async () => {
    expect(adapter.generateSchema).toBeTypeOf('function')
  })

  it('implements transactions', async () => {
    const id = await adapter.beginTransaction()
    expect(id).toBeTruthy()
    await adapter.rollbackTransaction(id!)
  })

  it('implements migration helpers', async () => {
    expect(adapter.migrate).toBeTypeOf('function')
    expect(adapter.migrateStatus).toBeTypeOf('function')
    expect(adapter.migrateFresh).toBeTypeOf('function')
    await expect(adapter.migrateStatus()).resolves.toBeUndefined()
  })
})
