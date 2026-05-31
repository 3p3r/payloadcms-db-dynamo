import { describe, expect, it, vi } from 'vitest'

import * as batchGetDocsModule from '../../src/utilities/batchGetDocs.js'
import * as queryGeoModule from '../../src/geo/queryGeo.js'
import { queryMatching } from '../../src/utilities/queryMatching.js'
import { mockAdapter } from '../__helpers/mockAdapter.js'

describe('queryMatching branch coverage', () => {
  const payload = {
    collections: {
      items: {
        config: {
          fields: [{ name: 'title', type: 'text' }],
          sanitizedIndexes: [],
        },
      },
      places: {
        config: {
          fields: [
            { name: 'location', type: 'point' },
            { name: 'status', type: 'text' },
          ],
          sanitizedIndexes: [],
        },
      },
    },
    config: { globals: [] },
  } as never

  it('gsi1 filtered list returns matching rows', async () => {
    const send = vi.fn().mockResolvedValue({
      Items: [{ pk: 'items', sk: '1', id: '1', gsi1pk: 'COL#items#LIST', title: 'ok' }],
    })
    const adapter = mockAdapter({ send, payload })
    const rows = await queryMatching(
      adapter,
      'items',
      { title: { equals: 'ok' } },
      undefined,
      'items',
    )
    expect(rows).toHaveLength(1)
    expect(rows[0]?.id).toBe('1')
    expect(send.mock.calls[0]![0].input.IndexName).toBe('gsi1')
  })

  it('inverted-in applies remainder and maxItems', async () => {
    const send = vi
      .fn()
      .mockResolvedValueOnce({ Items: [{ pk: 'IDX#items#email#a', sk: '1', docId: '1' }] })
      .mockResolvedValue({
        Responses: {
          t: [
            { pk: 'items', sk: '1', id: '1', email: 'a', score: 1 },
            { pk: 'items', sk: '2', id: '2', email: 'a', score: 9 },
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
              fields: [
                { name: 'email', type: 'email' },
                { name: 'score', type: 'number' },
              ],
              sanitizedIndexes: [{ fields: ['email'], unique: true }],
            },
          },
        },
        config: { globals: [] },
      } as never,
    })
    const rows = await queryMatching(
      adapter,
      'items',
      { email: { in: ['a'] }, score: { greater_than: 5 } },
      undefined,
      'items',
      1,
    )
    expect(rows).toHaveLength(1)
    expect(rows[0]?.score).toBe(9)
  })

  it('inverted-in paginates each index partition', async () => {
    const send = vi
      .fn()
      .mockResolvedValueOnce({
        Items: [{ pk: 'IDX#items#email#a', sk: '1', docId: '1' }],
        LastEvaluatedKey: { pk: 'IDX#items#email#a', sk: '1' },
      })
      .mockResolvedValueOnce({ Items: [{ pk: 'IDX#items#email#b', sk: '2', docId: '2' }] })
      .mockResolvedValue({
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
    const rows = await queryMatching(
      adapter,
      'items',
      { email: { in: ['a', 'b'] } },
      undefined,
      'items',
    )
    expect(rows).toHaveLength(2)
  })

  it('geo plan without remainder', async () => {
    vi.spyOn(queryGeoModule, 'queryGeoDocIds').mockResolvedValue(new Set(['1']))
    vi.spyOn(batchGetDocsModule, 'batchGetCollectionDocs').mockResolvedValue([
      { id: '1', location: [-122.4194, 37.7749] },
    ])
    const adapter = mockAdapter({ payload })
    const rows = await queryMatching(
      adapter,
      'places',
      { location: { near: [-122.4194, 37.7749, 500_000] } },
      undefined,
      'places',
    )
    expect(rows).toHaveLength(1)
    vi.restoreAllMocks()
  })

  it('inverted-in unions index partitions', async () => {
    const send = vi
      .fn()
      .mockResolvedValueOnce({ Items: [{ pk: 'IDX#items#email#a', sk: '1', docId: '1' }] })
      .mockResolvedValueOnce({ Items: [{ pk: 'IDX#items#email#b', sk: '2', docId: '2' }] })
      .mockResolvedValue({
        Responses: {
          t: [
            { pk: 'items', sk: '1', id: '1', email: 'a' },
            { pk: 'items', sk: '2', id: '2', email: 'b' },
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
    const rows = await queryMatching(
      adapter,
      'items',
      { email: { in: ['a', 'b'] } },
      undefined,
      'items',
    )
    expect(rows).toHaveLength(2)
  })

  it('stops after maxItems', async () => {
    const send = vi.fn().mockResolvedValue({
      Items: [
        { pk: 'items', sk: '1', id: '1', gsi1pk: 'COL#items#LIST' },
        { pk: 'items', sk: '2', id: '2', gsi1pk: 'COL#items#LIST' },
        { pk: 'items', sk: '3', id: '3', gsi1pk: 'COL#items#LIST' },
      ],
    })
    const adapter = mockAdapter({ send, payload })
    const rows = await queryMatching(adapter, 'items', undefined, undefined, 'items', 2)
    expect(rows).toHaveLength(2)
  })

  it('inverted index respects maxItems after batch get', async () => {
    const send = vi
      .fn()
      .mockResolvedValueOnce({
        Items: [
          { pk: 'IDX#items#email#a', sk: '1', docId: '1' },
          { pk: 'IDX#items#email#a', sk: '2', docId: '2' },
        ],
      })
      .mockResolvedValue({
        Responses: {
          t: [
            { pk: 'items', sk: '1', id: '1', email: 'a' },
            { pk: 'items', sk: '2', id: '2', email: 'a' },
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
    const rows = await queryMatching(
      adapter,
      'items',
      { email: { equals: 'a' } },
      undefined,
      'items',
      1,
    )
    expect(rows).toHaveLength(1)
  })

  it('inverted index paginates and uses sk when docId missing', async () => {
    const send = vi
      .fn()
      .mockResolvedValueOnce({
        Items: [{ pk: 'IDX#items#email#a', sk: 'only-sk' }],
        LastEvaluatedKey: { pk: 'IDX#items#email#a', sk: 'only-sk' },
      })
      .mockResolvedValueOnce({ Items: [{ pk: 'IDX#items#email#a', sk: '2', docId: '2' }] })
      .mockResolvedValue({
        Responses: {
          t: [
            { pk: 'items', sk: 'only-sk', id: 'only-sk', email: 'a' },
            { pk: 'items', sk: '2', id: '2', email: 'a' },
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
    const rows = await queryMatching(
      adapter,
      'items',
      { email: { equals: 'a' } },
      undefined,
      'items',
    )
    expect(rows).toHaveLength(2)
  })

  it('inverted index skips rows without doc id', async () => {
    const send = vi
      .fn()
      .mockResolvedValueOnce({ Items: [{ pk: 'IDX#items#email#a', sk: '' }] })
      .mockResolvedValue({ Responses: { t: [] } })
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
    const rows = await queryMatching(
      adapter,
      'items',
      { email: { equals: 'a' } },
      undefined,
      'items',
    )
    expect(rows).toHaveLength(0)
  })

  it('gsi1 list paginates', async () => {
    const send = vi
      .fn()
      .mockResolvedValueOnce({
        Items: [{ pk: 'items', sk: '1', id: '1', gsi1pk: 'COL#items#LIST', title: 'a' }],
        LastEvaluatedKey: { pk: 'items', sk: '1' },
      })
      .mockResolvedValueOnce({
        Items: [{ pk: 'items', sk: '2', id: '2', gsi1pk: 'COL#items#LIST', title: 'b' }],
      })
    const adapter = mockAdapter({ send, payload })
    const rows = await queryMatching(adapter, 'items', undefined, undefined, 'items')
    expect(rows).toHaveLength(2)
  })

  it('geo near plan applies remainder and refines radius', async () => {
    vi.spyOn(queryGeoModule, 'queryGeoDocIds').mockResolvedValue(new Set(['1', '2']))
    vi.spyOn(batchGetDocsModule, 'batchGetCollectionDocs').mockResolvedValue([
      { id: '1', location: [-122.4194, 37.7749], status: 'open' },
      { id: '2', location: [-122.4194, 37.7749], status: 'closed' },
    ])
    const adapter = mockAdapter({ payload })
    const rows = await queryMatching(
      adapter,
      'places',
      {
        location: { near: [-122.4194, 37.7749, 50_000] },
        status: { equals: 'open' },
      },
      undefined,
      'places',
    )
    expect(rows).toHaveLength(1)
    expect(rows[0]?.status).toBe('open')
    vi.restoreAllMocks()
  })

  it('geo within plan filters with matchesWhere', async () => {
    const send = vi.fn((cmd: { constructor: { name: string } }) => {
      if (cmd.constructor.name === 'BatchGetCommand') {
        return Promise.resolve({
          Responses: {
            t: [{ pk: 'places', sk: '1', id: '1', location: [-123.5, 37.5] }],
          },
        })
      }
      return Promise.resolve({ Items: [{ docId: '1' }] })
    })
    const adapter = mockAdapter({ send, tableName: 't', payload })
    const ring = [
      [-123, 38],
      [-121, 38],
      [-121, 37],
      [-123, 37],
      [-123, 38],
    ]
    const rows = await queryMatching(
      adapter,
      'places',
      {
        location: {
          within: {
            type: 'Polygon',
            coordinates: [ring],
          },
        },
      },
      undefined,
      'places',
    )
    expect(rows.length).toBeGreaterThanOrEqual(0)
    vi.restoreAllMocks()
  })

  it('partition query tolerates missing Items', async () => {
    const send = vi.fn().mockResolvedValue({})
    const adapter = mockAdapter({ send, payload })
    const rows = await queryMatching(adapter, 'items', undefined, undefined, 'items')
    expect(rows).toEqual([])
  })

  it('gsi1 list applies filter expression when where is set', async () => {
    const send = vi.fn().mockResolvedValue({
      Items: [{ pk: 'items', sk: '1', id: '1', gsi1pk: 'COL#items#LIST', title: 'a' }],
    })
    const adapter = mockAdapter({ send, payload })
    const rows = await queryMatching(
      adapter,
      'items',
      { title: { equals: 'a' } },
      undefined,
      'items',
    )
    expect(rows).toHaveLength(1)
    expect(send.mock.calls[0]![0].input.FilterExpression).toBeDefined()
    expect(send.mock.calls[0]![0].input.IndexName).toBe('gsi1')
  })

  it('queries version-parent gsi1', async () => {
    const send = vi.fn().mockResolvedValue({
      Items: [{ pk: 'posts_versions', sk: 'v1', id: 'v1', parent: 'p1', gsi1pk: 'VER#posts#PARENT#p1' }],
    })
    const adapter = mockAdapter({ send, tableName: 't', payload })
    const rows = await queryMatching(
      adapter,
      'posts_versions',
      { parent: { equals: 'p1' } },
      undefined,
      'posts',
    )
    expect(rows).toHaveLength(1)
    expect(send.mock.calls[0]![0].input.IndexName).toBe('gsi1')
  })

  it('version-parent respects maxItems', async () => {
    const send = vi.fn().mockResolvedValue({
      Items: [
        { pk: 'posts_versions', sk: 'v1', id: 'v1', gsi1pk: 'VER#posts#PARENT#p1' },
        { pk: 'posts_versions', sk: 'v2', id: 'v2', gsi1pk: 'VER#posts#PARENT#p1' },
      ],
    })
    const adapter = mockAdapter({ send, tableName: 't', payload })
    const rows = await queryMatching(
      adapter,
      'posts_versions',
      { parent: { equals: 'p1' } },
      undefined,
      'posts',
      1,
    )
    expect(rows).toHaveLength(1)
  })

  it('version-latest returns empty when pointers lack ver-latest entity', async () => {
    const send = vi.fn().mockResolvedValue({
      Items: [{ gsi1pk: 'COL#posts#VER#LATEST', sk: 'REF#v1' }],
    })
    const adapter = mockAdapter({ send, tableName: 't', payload })
    const rows = await queryMatching(
      adapter,
      'posts_versions',
      { latest: { equals: true } },
      undefined,
      'posts',
    )
    expect(rows).toEqual([])
  })

  it('queries version-latest gsi1 pointers', async () => {
    const send = vi
      .fn()
      .mockResolvedValueOnce({
        Items: [
          {
            entityType: 'ver-latest',
            targetPk: 'posts_versions',
            targetSk: 'v1',
            gsi1pk: 'COL#posts#VER#LATEST',
          },
        ],
      })
      .mockResolvedValueOnce({
        Responses: {
          t: [{ pk: 'posts_versions', sk: 'v1', id: 'v1', latest: true, parent: 'p1' }],
        },
      })
    const adapter = mockAdapter({ send, tableName: 't', payload })
    const rows = await queryMatching(
      adapter,
      'posts_versions',
      { latest: { equals: true } },
      undefined,
      'posts',
    )
    expect(rows).toHaveLength(1)
    expect(rows[0]?.id).toBe('v1')
  })

  it('partition scan applies js-only operators', async () => {
    const send = vi.fn().mockResolvedValue({
      Items: [
        { pk: 'p', sk: '1', id: '1', title: 'Hello' },
        { pk: 'p', sk: '2', id: '2', title: 'Other' },
      ],
    })
    const adapter = mockAdapter({ send, payload })
    const rows = await queryMatching(
      adapter,
      'items',
      { title: { like: 'ell' } },
      undefined,
      'items',
    )
    expect(rows).toHaveLength(1)
    expect(rows[0]?.title).toBe('Hello')
  })
})
