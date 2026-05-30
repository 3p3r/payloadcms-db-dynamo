import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { initPayloadTest, type TestHandle } from '../__helpers/initPayload.js'
import { config } from './config.js'

let handle: TestHandle

beforeAll(async () => {
  handle = await initPayloadTest('joins', config)
})

afterAll(async () => {
  await handle?.cleanup()
})

describe('joins', () => {
  it('find with joins populates related docs', async () => {
    const cat = await handle.payload.create({
      collection: 'categories',
      data: { name: 'News' },
    })
    const post = await handle.payload.create({
      collection: 'posts',
      data: { title: 'Hello', category: cat.id },
    })

    const result = await handle.payload.db.find({
      collection: 'categories',
      where: { id: { equals: cat.id } },
      joins: {
        posts: { limit: 5 },
      },
    })

    const joinData = result.docs[0]?.posts as {
      docs?: { title: string }[]
      totalDocs?: number
    }
    expect(joinData?.docs?.map((d) => d.title)).toContain('Hello')

    const withCount = await handle.payload.db.find({
      collection: 'categories',
      where: { id: { equals: cat.id } },
      joins: { posts: { limit: 0, count: true } },
    })
    const counted = withCount.docs[0]?.posts as { totalDocs?: number }
    expect(counted?.totalDocs).toBeGreaterThan(0)
  })
})
