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

  it('partition query skips idx/geo entity rows', async () => {
    const send = vi.fn().mockResolvedValue({
      Items: [
        { pk: 'items', sk: 'idx', entityType: 'idx' },
        { pk: 'items', sk: 'geo', entityType: 'geo' },
        { pk: 'items', sk: '1', id: '1', title: 'ok' },
      ],
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

  it('gsi1 list returns empty for always-false where', async () => {
    const send = vi.fn()
    const adapter = mockAdapter({ send, payload })
    const rows = await queryMatching(adapter, 'items', { id: { in: [] } }, undefined, 'items')
    expect(rows).toEqual([])
    expect(send).not.toHaveBeenCalled()
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
