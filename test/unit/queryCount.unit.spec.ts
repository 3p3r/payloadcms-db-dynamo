import { describe, expect, it, vi } from 'vitest'

import { queryCount } from '../../src/utilities/queryCount.js'
import { mockAdapter } from '../__helpers/mockAdapter.js'
import * as queryMatchingModule from '../../src/utilities/queryMatching.js'

describe('queryCount', () => {
  it('counts via queryMatching when where uses JS-only operators', async () => {
    vi.spyOn(queryMatchingModule, 'queryMatching').mockResolvedValue([{}, {}])
    const total = await queryCount(mockAdapter(), 'posts', { title: { like: 'a' } })
    expect(total).toBe(2)
    vi.restoreAllMocks()
  })

  it('counts all rows when where is empty', async () => {
    const send = vi.fn().mockResolvedValue({ Count: 4 })
    expect(await queryCount(mockAdapter({ send }), 'p', {})).toBe(4)
    expect(send.mock.calls[0]![0].input.FilterExpression).toBeUndefined()
  })

  it('paginates COUNT queries', async () => {
    const send = vi
      .fn()
      .mockResolvedValueOnce({ Count: 2, LastEvaluatedKey: { pk: 'p', sk: 'c' } })
      .mockResolvedValueOnce({ Count: undefined })
    const total = await queryCount(mockAdapter({ send }), 'p', { title: { equals: 'x' } })
    expect(total).toBe(2)
    expect(send).toHaveBeenCalledTimes(2)
    await expect(queryCount(mockAdapter({ docClient: undefined }), 'p', {})).rejects.toThrow(
      /docClient/,
    )
    expect(await queryCount(mockAdapter({ send }), 'p', { id: { in: [] } })).toBe(0)
  })

  it('counts via gsi1 for filtered collection list', async () => {
    const send = vi.fn().mockResolvedValue({ Count: 3 })
    const adapter = mockAdapter({
      send,
      payload: {
        collections: {
          posts: { config: { fields: [{ name: 'title', type: 'text' }], sanitizedIndexes: [] } },
        },
        config: { globals: [] },
      } as never,
    })
    const total = await queryCount(adapter, 'posts', { title: { equals: 'x' } }, 'posts')
    expect(total).toBe(3)
    expect(send.mock.calls[0]![0].input.IndexName).toBe('gsi1')
  })

  it('uses queryMatching for inverted equals with remainder', async () => {
    const spy = vi.spyOn(queryMatchingModule, 'queryMatching').mockResolvedValue([{}])
    const adapter = mockAdapter({
      payload: {
        collections: {
          items: {
            config: {
              fields: [{ name: 'email', type: 'email' }],
              sanitizedIndexes: [{ fields: ['email'], unique: true }],
            },
          },
        },
        config: { globals: [] },
      } as never,
    })
    const total = await queryCount(
      adapter,
      'items',
      { email: { equals: 'a' }, score: { greater_than: 1 } },
      'items',
    )
    expect(total).toBe(1)
    expect(spy).toHaveBeenCalled()
    vi.restoreAllMocks()
  })

  it('counts geo and inverted-in via queryMatching', async () => {
    const spy = vi.spyOn(queryMatchingModule, 'queryMatching').mockResolvedValue([{}, {}])
    const payload = {
      collections: {
        places: {
          config: {
            fields: [{ name: 'location', type: 'point' }],
            sanitizedIndexes: [],
          },
        },
        items: {
          config: {
            fields: [{ name: 'email', type: 'email' }],
            sanitizedIndexes: [{ fields: ['email'], unique: true }],
          },
        },
      },
      config: { globals: [] },
    } as never
    const placesAdapter = mockAdapter({ payload })
    expect(
      await queryCount(placesAdapter, 'places', { location: { near: [1, 2, 1000] } }, 'places'),
    ).toBe(2)
    const itemsAdapter = mockAdapter({ payload })
    expect(
      await queryCount(itemsAdapter, 'items', { email: { in: ['a', 'b'] } }, 'items'),
    ).toBe(2)
    expect(spy).toHaveBeenCalled()
    vi.restoreAllMocks()
  })

  it('counts reverse-index via queryMatching', async () => {
    const send = vi
      .fn()
      .mockResolvedValueOnce({
        Items: [
          { pk: 'IDX#items#email#a', sk: '1', docId: '1' },
          { pk: 'IDX#items#email#b', sk: '2', docId: '2' },
        ],
      })
      .mockResolvedValueOnce({
        Responses: {
          t: [
            { pk: 'items', sk: '1', id: '1' },
            { pk: 'items', sk: '2', id: '2' },
          ],
        },
      })
    const adapter = mockAdapter({
      send,
      tableName: 't',
      payload: {
        collections: {
          items: {
            config: {
              fields: [{ name: 'email', type: 'email' }],
              sanitizedIndexes: [{ fields: ['email'], unique: true }],
            },
          },
        },
        config: { globals: [] },
      } as never,
    })
    const count = await queryCount(adapter, 'items', { email: { exists: true } }, 'items')
    expect(count).toBe(2)
  })

  it('counts inverted pk without remainder', async () => {
    const send = vi.fn().mockResolvedValue({ Count: 2 })
    const adapter = mockAdapter({
      send,
      payload: {
        collections: {
          items: {
            config: {
              fields: [{ name: 'email', type: 'email' }],
              sanitizedIndexes: [{ fields: ['email'], unique: true }],
            },
          },
        },
        config: { globals: [] },
      } as never,
    })
    expect(await queryCount(adapter, 'items', { email: { equals: 'a' } }, 'items')).toBe(2)
  })

  it('counts version gsi1 plans', async () => {
    const send = vi.fn().mockResolvedValue({ Count: 1 })
    const adapter = mockAdapter({ send })
    expect(
      await queryCount(adapter, 'posts_versions', { latest: { equals: true } }, 'posts'),
    ).toBe(1)
    expect(
      await queryCount(adapter, 'posts_versions', { parent: { equals: 'p1' } }, 'posts'),
    ).toBe(1)
    expect(send.mock.calls.every((c) => c[0].input.IndexName === 'gsi1')).toBe(true)
  })

  it('counts version-latest with remainder on gsi1', async () => {
    const send = vi.fn().mockResolvedValue({ Count: 1 })
    const adapter = mockAdapter({ send })
    expect(
      await queryCount(
        adapter,
        'posts_versions',
        { latest: { equals: true }, autosave: { equals: false } },
        'posts',
      ),
    ).toBe(1)
    expect(send.mock.calls[0]![0].input.FilterExpression).toBeDefined()
  })
})
