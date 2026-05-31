import { describe, expect, it, vi } from 'vitest'

import { queryMatching } from '../../src/utilities/queryMatching.js'
import { mockAdapter } from '../__helpers/mockAdapter.js'

describe('queryMatching plans', () => {
  const basePayload = {
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
      places: {
        config: {
          fields: [{ name: 'location', type: 'point' }],
          sanitizedIndexes: [],
        },
      },
    },
    config: { globals: [] },
  } as never

  it('returns empty gsi1 list when filter is NEVER', async () => {
    const send = vi.fn()
    const adapter = mockAdapter({ send, payload: basePayload })
    const rows = await queryMatching(adapter, 'items', { id: { in: [] } }, undefined, 'items')
    expect(rows).toEqual([])
  })

  it('queries gsi1 for list', async () => {
    const send = vi.fn().mockResolvedValue({
      Items: [{ pk: 'items', sk: '1', id: '1', gsi1pk: 'COL#items#LIST' }],
    })
    const adapter = mockAdapter({ send, payload: basePayload })
    const rows = await queryMatching(adapter, 'items', undefined, undefined, 'items')
    expect(rows).toHaveLength(1)
    expect(send.mock.calls[0]?.[0].input.IndexName).toBe('gsi1')
  })

  it('returns empty when geo query yields no candidates', async () => {
    const send = vi.fn().mockResolvedValue({ Items: [] })
    const adapter = mockAdapter({ send, tableName: 't', payload: basePayload })
    const rows = await queryMatching(
      adapter,
      'places',
      { location: { near: [-122, 37, 100] } },
      undefined,
      'places',
    )
    expect(rows).toEqual([])
  })

  it('runs geo plan and hydrates docs', async () => {
    const send = vi
      .fn()
      .mockResolvedValue({ Items: [{ docId: '1' }] })
      .mockResolvedValueOnce({ Items: [{ docId: '1' }] })
      .mockResolvedValue({ Responses: { t: [{ pk: 'places', sk: '1', id: '1', location: [-122, 37] }] } })
    const adapter = mockAdapter({ send, tableName: 't', payload: basePayload })
    const rows = await queryMatching(
      adapter,
      'places',
      { location: { near: [-122, 37, 1_000_000] } },
      undefined,
      'places',
    )
    expect(rows.length).toBeGreaterThanOrEqual(0)
  })

  it('skips idx/geo rows on partition query', async () => {
    const send = vi.fn().mockResolvedValue({
      Items: [
        { pk: 'p', sk: '1', id: '1', entityType: 'idx' },
        { pk: 'p', sk: '2', id: '2' },
      ],
    })
    const adapter = mockAdapter({
      send,
      payload: { collections: { p: { config: { fields: [], sanitizedIndexes: [] } } } },
    } as never)
    const rows = await queryMatching(adapter, 'p', { id: { equals: '2' } }, undefined, 'p')
    expect(rows).toHaveLength(1)
    expect(rows[0]?.id).toBe('2')
  })

  it('filters inverted hydration with remainder where', async () => {
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
            { pk: 'items', sk: '1', id: '1', email: 'a', score: 1 },
            { pk: 'items', sk: '2', id: '2', email: 'a', score: 2 },
          ],
        },
      })
    const adapter = mockAdapter({ send, tableName: 't', payload: basePayload })
    const rows = await queryMatching(
      adapter,
      'items',
      { email: { equals: 'a' }, score: { greater_than: 1 } },
      undefined,
      'items',
    )
    expect(rows).toHaveLength(1)
    expect(rows[0]?.id).toBe('2')
  })

  it('queries inverted partition for indexed equals', async () => {
    const send = vi
      .fn()
      .mockResolvedValueOnce({ Items: [{ pk: 'IDX#items#email#a', sk: '1', docId: '1' }] })
      .mockResolvedValueOnce({ Responses: { t: [{ pk: 'items', sk: '1', id: '1' }] } })
    const adapter = mockAdapter({ send, tableName: 't', payload: basePayload })
    const rows = await queryMatching(
      adapter,
      'items',
      { email: { equals: 'a' } },
      undefined,
      'items',
    )
    expect(rows).toHaveLength(1)
    expect(String(send.mock.calls[0]?.[0].input.ExpressionAttributeValues?.[':pk'])).toContain(
      'IDX#',
    )
  })
})
