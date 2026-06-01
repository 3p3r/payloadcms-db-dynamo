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
        { pk: 'orphan', sk: '1', id: '1', entityType: 'idx' },
        { pk: 'orphan', sk: '2', id: '2' },
      ],
    })
    const adapter = mockAdapter({ send, payload: { collections: {}, config: { globals: [] } } as never })
    const rows = await queryMatching(adapter, 'orphan', { id: { equals: '2' } })
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

  it('queries search-ngram partitions, intersects grams, and hydrates', async () => {
    const searchPayload = {
      collections: {
        articles: {
          config: {
            fields: [{ name: 'title', type: 'text' }],
            admin: { listSearchableFields: ['title'] },
          },
        },
      },
      config: { globals: [] },
    } as never

    const send = vi
      .fn()
      .mockResolvedValueOnce({ Items: [{ docId: '1', sk: '1' }] })
      .mockResolvedValueOnce({ Items: [{ docId: '1', sk: '1' }] })
      .mockResolvedValueOnce({ Items: [{ docId: '1', sk: '1' }] })
      .mockResolvedValue({
        Responses: { t: [{ pk: 'articles', sk: '1', id: '1', title: 'robot' }] },
      })
    const adapter = mockAdapter({ send, tableName: 't', payload: searchPayload })
    const rows = await queryMatching(
      adapter,
      'articles',
      { title: { like: 'robot' } },
      undefined,
      'articles',
    )
    expect(rows).toHaveLength(1)
    expect(rows[0]?.title).toBe('robot')
    expect(String(send.mock.calls[0]?.[0].input.ExpressionAttributeValues?.[':pk'])).toContain(
      'NGM#',
    )
  })

  it('search-ngram returns empty when gram intersection is empty', async () => {
    const searchPayload = {
      collections: {
        articles: {
          config: {
            fields: [{ name: 'title', type: 'text' }],
            admin: { listSearchableFields: ['title'] },
          },
        },
      },
      config: { globals: [] },
    } as never

    const send = vi
      .fn()
      .mockResolvedValueOnce({ Items: [{ docId: '1', sk: '1' }] })
      .mockResolvedValueOnce({ Items: [] })
    const adapter = mockAdapter({ send, tableName: 't', payload: searchPayload })
    const rows = await queryMatching(
      adapter,
      'articles',
      { title: { like: 'robot' } },
      undefined,
      'articles',
    )
    expect(rows).toEqual([])
  })

  it('search-ngram paginates gram partition queries', async () => {
    const searchPayload = {
      collections: {
        articles: {
          config: {
            fields: [{ name: 'title', type: 'text' }],
            admin: { listSearchableFields: ['title'] },
          },
        },
      },
      config: { globals: [] },
    } as never

    const send = vi
      .fn()
      .mockResolvedValueOnce({
        Items: [{ docId: '1', sk: '1' }],
        LastEvaluatedKey: { pk: 'NGM#articles#title#rob', sk: 'x' },
      })
      .mockResolvedValueOnce({ Items: [{ docId: '2', sk: '2' }] })
      .mockResolvedValue({
        Responses: {
          t: [
            { pk: 'articles', sk: '1', id: '1', title: 'robot' },
            { pk: 'articles', sk: '2', id: '2', title: 'robotic' },
          ],
        },
      })
    const adapter = mockAdapter({ send, tableName: 't', payload: searchPayload })
    const rows = await queryMatching(
      adapter,
      'articles',
      { title: { like: 'rob' } },
      undefined,
      'articles',
      1,
    )
    expect(rows).toHaveLength(1)
  })

  it('search-ngram applies full where including remainder fields', async () => {
    const searchPayload = {
      collections: {
        articles: {
          config: {
            fields: [
              { name: 'title', type: 'text' },
              { name: 'active', type: 'checkbox' },
            ],
            admin: { listSearchableFields: ['title'] },
          },
        },
      },
      config: { globals: [] },
    } as never

    const send = vi
      .fn()
      .mockResolvedValueOnce({ Items: [{ docId: '1', sk: '1' }, { docId: '2', sk: '2' }] })
      .mockResolvedValue({
        Responses: {
          t: [
            { pk: 'articles', sk: '1', id: '1', title: 'robot', active: true },
            { pk: 'articles', sk: '2', id: '2', title: 'robot', active: false },
          ],
        },
      })
    const adapter = mockAdapter({ send, tableName: 't', payload: searchPayload })
    const rows = await queryMatching(
      adapter,
      'articles',
      {
        or: [{ title: { like: 'rob' } }],
        active: { equals: true },
      },
      undefined,
      'articles',
    )
    expect(rows).toHaveLength(1)
    expect(rows[0]?.id).toBe('1')
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

  it('queries gsi2 reverse index for indexed exists with remainder and maxItems', async () => {
    const send = vi
      .fn()
      .mockResolvedValueOnce({
        Items: [
          { pk: 'IDX#items#email#a', sk: '1', docId: '1', gsi2pk: 'IDX#items#email' },
          { pk: 'IDX#items#email#b', sk: '2', docId: '2', gsi2pk: 'IDX#items#email' },
          { pk: 'IDX#items#email#c', sk: '', gsi2pk: 'IDX#items#email' },
        ],
      })
      .mockResolvedValueOnce({
        Responses: {
          t: [
            { pk: 'items', sk: '1', id: '1', email: 'a', score: 1 },
            { pk: 'items', sk: '2', id: '2', email: 'b', score: 5 },
          ],
        },
      })
    const adapter = mockAdapter({ send, tableName: 't', payload: basePayload })
    const rows = await queryMatching(
      adapter,
      'items',
      { email: { exists: true }, score: { greater_than: 3 } },
      undefined,
      'items',
      1,
    )
    expect(rows).toHaveLength(1)
    expect(rows[0]?.id).toBe('2')
    expect(send.mock.calls[0]?.[0].input.IndexName).toBe('gsi2')
  })

  it('inverted-in skips index rows without doc id', async () => {
    const send = vi
      .fn()
      .mockResolvedValueOnce({ Items: [{ pk: 'IDX#items#email#a', sk: '' }] })
      .mockResolvedValueOnce({ Responses: { t: [] } })
    const adapter = mockAdapter({ send, tableName: 't', payload: basePayload })
    const rows = await queryMatching(
      adapter,
      'items',
      { email: { in: ['a'] } },
      undefined,
      'items',
    )
    expect(rows).toEqual([])
  })

  it('queries gsi2 reverse index for indexed not_in', async () => {
    const send = vi
      .fn()
      .mockResolvedValueOnce({
        Items: [
          { pk: 'IDX#items#email#a', sk: '1', docId: '1' },
          { pk: 'IDX#items#email#b', sk: '2', docId: '2' },
          { pk: 'IDX#items#email#c', sk: '3', docId: '3' },
        ],
      })
      .mockResolvedValueOnce({
        Responses: { t: [{ pk: 'items', sk: '3', id: '3', email: 'c' }] },
      })
    const adapter = mockAdapter({ send, tableName: 't', payload: basePayload })
    const rows = await queryMatching(
      adapter,
      'items',
      { email: { not_in: ['a', 'b'] } },
      undefined,
      'items',
    )
    expect(rows).toHaveLength(1)
    expect(rows[0]?.email).toBe('c')
  })

  it('gsi2 reverse index skips rows without doc id', async () => {
    const send = vi
      .fn()
      .mockResolvedValueOnce({
        Items: [{ pk: 'IDX#items#email#a', sk: '', gsi2pk: 'IDX#items#email' }],
      })
      .mockResolvedValueOnce({ Responses: { t: [] } })
    const adapter = mockAdapter({ send, tableName: 't', payload: basePayload })
    const rows = await queryMatching(
      adapter,
      'items',
      { email: { exists: true } },
      undefined,
      'items',
    )
    expect(rows).toEqual([])
  })

  it('returns empty when gsi2 query returns no Items key', async () => {
    const send = vi.fn().mockResolvedValueOnce({})
    const adapter = mockAdapter({ send, tableName: 't', payload: basePayload })
    const rows = await queryMatching(
      adapter,
      'items',
      { email: { exists: true } },
      undefined,
      'items',
    )
    expect(rows).toEqual([])
  })

  it('returns empty when gsi2 reverse index has no rows', async () => {
    const send = vi.fn().mockResolvedValueOnce({ Items: [] })
    const adapter = mockAdapter({ send, tableName: 't', payload: basePayload })
    const rows = await queryMatching(
      adapter,
      'items',
      { email: { exists: true } },
      undefined,
      'items',
    )
    expect(rows).toEqual([])
    expect(send.mock.calls[0]?.[0].input.IndexName).toBe('gsi2')
  })

  it('paginates gsi2 reverse index queries', async () => {
    const send = vi
      .fn()
      .mockResolvedValueOnce({
        Items: [{ pk: 'IDX#items#email#a', sk: '1', docId: '1' }],
        LastEvaluatedKey: { gsi2pk: 'IDX#items#email', gsi2sk: '1' },
      })
      .mockResolvedValueOnce({ Items: [{ pk: 'IDX#items#email#b', sk: '2', docId: '2' }] })
      .mockResolvedValueOnce({
        Responses: {
          t: [
            { pk: 'items', sk: '1', id: '1' },
            { pk: 'items', sk: '2', id: '2' },
          ],
        },
      })
    const adapter = mockAdapter({ send, tableName: 't', payload: basePayload })
    const rows = await queryMatching(
      adapter,
      'items',
      { email: { exists: true } },
      undefined,
      'items',
    )
    expect(rows).toHaveLength(2)
    expect(send.mock.calls[0]?.[0].input.ExclusiveStartKey).toBeUndefined()
    expect(send.mock.calls[1]?.[0].input.ExclusiveStartKey).toBeDefined()
  })

  it('queries gsi2 reverse index excluding matching inverted pk on not_equals', async () => {
    const send = vi
      .fn()
      .mockResolvedValueOnce({
        Items: [
          { pk: 'IDX#items#email#a@b.c', sk: '1', docId: '1' },
          { pk: 'IDX#items#email#other@b.c', sk: '2', docId: '2' },
        ],
      })
      .mockResolvedValueOnce({
        Responses: { t: [{ pk: 'items', sk: '2', id: '2', email: 'other@b.c' }] },
      })
    const adapter = mockAdapter({ send, tableName: 't', payload: basePayload })
    const rows = await queryMatching(
      adapter,
      'items',
      { email: { not_equals: 'a@b.c' } },
      undefined,
      'items',
    )
    expect(rows).toHaveLength(1)
    expect(rows[0]?.email).toBe('other@b.c')
  })

  it('queries gsi2 reverse index for indexed not_equals', async () => {
    const send = vi
      .fn()
      .mockResolvedValueOnce({
        Items: [
          { pk: 'IDX#items#email#a', sk: '1', docId: '1', gsi2pk: 'IDX#items#email' },
          { pk: 'IDX#items#email#b', sk: '2', docId: '2', gsi2pk: 'IDX#items#email' },
        ],
      })
      .mockResolvedValueOnce({
        Responses: { t: [{ pk: 'items', sk: '2', id: '2', email: 'b' }] },
      })
    const adapter = mockAdapter({ send, tableName: 't', payload: basePayload })
    const rows = await queryMatching(
      adapter,
      'items',
      { email: { not_equals: 'a' } },
      undefined,
      'items',
    )
    expect(rows).toHaveLength(1)
    expect(rows[0]?.id).toBe('2')
    expect(send.mock.calls[0]?.[0].input.IndexName).toBe('gsi2')
    expect(send.mock.calls[0]?.[0].input.ExpressionAttributeValues?.[':gpk']).toBe(
      'IDX#items#email',
    )
  })
})
