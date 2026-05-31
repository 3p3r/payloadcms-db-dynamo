import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { initPayloadTest, type TestHandle } from '../__helpers/initPayload.js'
import { config } from './config.js'

let handle: TestHandle

beforeAll(async () => {
  handle = await initPayloadTest('search-index', config)
  await handle.payload.create({
    collection: 'articles',
    data: { title: 'Robots everywhere', body: 'Metal and circuits' },
  })
  await handle.payload.create({
    collection: 'articles',
    data: { title: 'Gardening tips', body: 'Soil and sunshine' },
  })
})

afterAll(async () => {
  await (handle as TestHandle | undefined)?.cleanup()
})

describe('search n-gram index', () => {
  it('find with like uses n-gram path and matches substring semantics', async () => {
    const result = await handle.payload.find({
      collection: 'articles',
      where: { title: { like: 'bot' } },
    })
    expect(result.totalDocs).toBe(1)
    expect(result.docs[0]?.title).toContain('Robot')
  })

  it('or of like on searchable fields matches any field', async () => {
    const result = await handle.payload.find({
      collection: 'articles',
      where: {
        or: [{ title: { like: 'sun' } }, { body: { like: 'sun' } }],
      },
    })
    expect(result.totalDocs).toBe(1)
    expect(result.docs[0]?.title).toBe('Gardening tips')
  })

  it('short search strings fall back without error', async () => {
    const result = await handle.payload.find({
      collection: 'articles',
      where: { title: { like: 'ab' } },
    })
    expect(result.totalDocs).toBe(0)
  })
})
