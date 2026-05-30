import { readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import type { DynamoAdapter } from '../../src/index.js'

import { initPayloadTest, type TestHandle } from '../__helpers/initPayload.js'
import { config } from './config.js'

let handle: TestHandle

beforeAll(async () => {
  handle = await initPayloadTest('generate-schema', config)
})

afterAll(async () => {
  await handle?.cleanup()
})

describe('generateSchema', () => {
  it('writes table and GSI definitions derived from config', async () => {
    const outputFile = join(tmpdir(), `payload-ddb-schema-${Date.now()}.json`)
    const adapter = handle.payload.db as DynamoAdapter

    await adapter.generateSchema?.({ outputFile, log: false })

    const raw = await readFile(outputFile, 'utf-8')
    const doc = JSON.parse(raw) as {
      tableName: string
      createTable: { GlobalSecondaryIndexes?: { IndexName: string }[] }
      collections: { slug: string; pointFields: string[] }[]
    }

    expect(doc.tableName).toBe(handle.tableName)
    expect(doc.createTable.GlobalSecondaryIndexes?.map((g) => g.IndexName)).toEqual(
      expect.arrayContaining(['gsi1', 'gsi2', 'geo-index']),
    )

    const posts = doc.collections.find((c) => c.slug === 'posts')
    expect(posts?.pointFields).toContain('location')

    const accounts = doc.collections.find((c) => c.slug === 'accounts')
    expect(accounts?.indexes.length).toBeGreaterThan(0)
  })

  it('writes default schema path when outputFile is omitted', async () => {
    const adapter = handle.payload.db as DynamoAdapter
    await expect(adapter.generateSchema?.({ log: false, prettify: true })).resolves.toBeUndefined()
  })
})
