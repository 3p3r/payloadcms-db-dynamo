import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { initPayloadTest, type TestHandle } from '../__helpers/initPayload.js'
import { config } from './config.js'

let handle: TestHandle

beforeAll(async () => {
  handle = await initPayloadTest('reverse-index', config)
  await handle.payload.create({ collection: 'accounts', data: { email: 'a@example.com' } })
  await handle.payload.create({ collection: 'accounts', data: { email: 'b@example.com' } })
  await handle.payload.create({ collection: 'accounts', data: { email: 'c@example.com' } })
})

afterAll(async () => {
  await (handle as TestHandle | undefined)?.cleanup()
})

describe('gsi2 reverse index on declared unique fields', () => {
  it('exists true returns all indexed accounts', async () => {
    const result = await handle.payload.find({
      collection: 'accounts',
      where: { email: { exists: true } },
    })
    expect(result.totalDocs).toBe(3)
  })

  it('not_equals excludes matching index row', async () => {
    const result = await handle.payload.find({
      collection: 'accounts',
      where: { email: { not_equals: 'a@example.com' } },
    })
    expect(result.totalDocs).toBe(2)
    expect(result.docs.map((d) => d.email).sort()).toEqual(['b@example.com', 'c@example.com'])
  })

  it('not_in excludes multiple index values', async () => {
    const result = await handle.payload.find({
      collection: 'accounts',
      where: { email: { not_in: ['a@example.com', 'b@example.com'] } },
    })
    expect(result.totalDocs).toBe(1)
    expect(result.docs[0]?.email).toBe('c@example.com')
  })
})
