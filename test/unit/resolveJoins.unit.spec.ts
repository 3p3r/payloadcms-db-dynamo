import { describe, expect, it, vi } from 'vitest'

import type { DynamoAdapter } from '../../src/types.js'
import * as queryMatchingModule from '../../src/utilities/queryMatching.js'
import { resolveJoins } from '../../src/utilities/resolveJoins.js'

function catsAdapter(
  fields: Record<string, unknown>[],
): DynamoAdapter {
  return {
    payload: {
      collections: {
        cats: { config: { slug: 'cats', fields } },
      },
    },
    resolvePartition: (slug: string) => slug,
    docClient: {},
  } as unknown as DynamoAdapter
}

describe('resolveJoins', () => {
  it('groups related docs onto parent rows', async () => {
    vi.spyOn(queryMatchingModule, 'queryMatching').mockResolvedValue([
      { id: 'p1', category: 'c1', title: 'Post' },
      { id: 'p2', category: 'c2', title: 'Other' },
    ])
    const doc = { id: 'c1' } as Record<string, unknown>
    await resolveJoins(
      catsAdapter([
        {
          name: 'related',
          type: 'join',
          collection: ['posts', 'articles'],
          on: 'category',
          defaultLimit: 2,
        },
      ]),
      { collectionSlug: 'cats', docs: [doc], joins: { related: { limit: 0, count: true } } },
    )
    const join = doc.related as { docs: { title: string }[]; totalDocs: number }
    expect(join.docs).toHaveLength(1)
    expect(join.docs[0]?.title).toBe('Post')
    expect(join.totalDocs).toBe(1)
    vi.restoreAllMocks()
  })

  it('assigns nested join paths and skips invalid joins', async () => {
    vi.spyOn(queryMatchingModule, 'queryMatching').mockResolvedValue([
      { id: 'p1', category: 'c1', title: 'Post' },
    ])
    const doc = { id: 'c1' } as Record<string, unknown>
    const adapter = catsAdapter([
      { name: 'meta.related', type: 'join', collection: 'posts', on: 'category' },
      { name: 'posts', type: 'join', collection: 'posts', on: 'category' },
      { name: 'orphan', type: 'join', collection: [], on: 'category' },
    ])

    await resolveJoins(adapter, {
      collectionSlug: 'cats',
      docs: [doc],
      joins: { 'meta.related': { limit: 1 } },
    })
    expect((doc.meta as { related: { docs: unknown[] } }).related.docs).toHaveLength(1)

    await resolveJoins(adapter, {
      collectionSlug: 'cats',
      docs: [doc],
      joins: { posts: { limit: 2 }, unknown: {}, skipped: undefined as never },
    })
    expect((doc.posts as { docs: { title: string }[] }).docs).toHaveLength(1)

    const spy = vi.mocked(queryMatchingModule.queryMatching)
    spy.mockClear()
    await resolveJoins(adapter, { collectionSlug: 'cats', docs: [doc], joins: { orphan: {} } })
    expect(spy).not.toHaveBeenCalled()

    vi.restoreAllMocks()
  })

  it('no-ops when collection config is missing', async () => {
    const spy = vi.spyOn(queryMatchingModule, 'queryMatching')
    await resolveJoins(
      { payload: { collections: {} }, resolvePartition: (s: string) => s } as never,
      { collectionSlug: 'cats', docs: [{ id: '1' }], joins: { related: {} } },
    )
    expect(spy).not.toHaveBeenCalled()
    vi.restoreAllMocks()
  })

  it('no-ops when joins or docs are empty', async () => {
    const spy = vi.spyOn(queryMatchingModule, 'queryMatching')
    await resolveJoins(
      catsAdapter([{ name: 'related', type: 'join', collection: 'posts', on: 'category' }]),
      { collectionSlug: 'cats', docs: [], joins: { related: {} } },
    )
    expect(spy).not.toHaveBeenCalled()
    vi.restoreAllMocks()
  })
})
