import { describe, expect, it, vi } from 'vitest'

import { extractGeoClause, queryGeoDocIds } from '../../src/geo/queryGeo.js'
import { mockAdapter } from '../__helpers/mockAdapter.js'

describe('geo/queryGeo', () => {
  it('returns null for unsupported operator', async () => {
    const adapter = mockAdapter()
    const ids = await queryGeoDocIds(
      adapter,
      'places',
      'location',
      'invalid' as 'near',
      {},
    )
    expect(ids).toBeNull()
  })

  it('returns null when geo is nested in and', () => {
    expect(
      extractGeoClause({ and: [{ location: { near: [1, 2, 3] } }] } as never),
    ).toBeNull()
  })

  it('extracts top-level geo clause', () => {
    const clause = extractGeoClause({ location: { near: [1, 2, 100] } })
    expect(clause?.field).toBe('location')
    expect(clause?.operator).toBe('near')
  })

  it('extracts within/intersects and remainder', () => {
    const within = extractGeoClause({
      location: { within: { coordinates: [] } },
      status: { equals: 'open' },
    })
    expect(within?.operator).toBe('within')
    expect(within?.remainder).toEqual({ status: { equals: 'open' } })

    const intersects = extractGeoClause({ location: { intersects: { type: 'Polygon' } } })
    expect(intersects?.operator).toBe('intersects')
    expect(intersects?.remainder).toBeUndefined()
  })

  it('uses sk when docId is missing on geo index rows', async () => {
    const send = vi.fn().mockResolvedValue({ Items: [{ sk: 'DOC#from-sk' }] })
    const adapter = mockAdapter({ send })
    const ids = await queryGeoDocIds(adapter, 'places', 'location', 'near', [-122.4194, 37.7749, 500_000])
    expect(ids?.has('from-sk')).toBe(true)
  })

  it('returns empty set for invalid polygon', async () => {
    const adapter = mockAdapter()
    const ids = await queryGeoDocIds(adapter, 'places', 'location', 'within', { coordinates: [] })
    expect(ids?.size).toBe(0)
  })

  it('returns empty set for invalid near', async () => {
    const adapter = mockAdapter()
    const ids = await queryGeoDocIds(adapter, 'places', 'location', 'near', 'bad')
    expect(ids?.size).toBe(0)
  })

  it('queries within polygon via geo cells', async () => {
    const send = vi.fn().mockResolvedValue({ Items: [{ docId: 'x' }] })
    const adapter = mockAdapter({ send })
    const ring = [
      [-123, 38],
      [-121, 38],
      [-121, 37],
      [-123, 37],
      [-123, 38],
    ]
    const ids = await queryGeoDocIds(adapter, 'places', 'location', 'within', {
      type: 'Polygon',
      coordinates: [ring],
    })
    expect(ids?.has('x')).toBe(true)
  })

  it('paginates geo-index queries', async () => {
    const send = vi
      .fn()
      .mockResolvedValueOnce({
        Items: [{ docId: 'a' }],
        LastEvaluatedKey: { pk: 'GEO#x', sk: 'DOC#a', geohash: '1' },
      })
      .mockResolvedValueOnce({ Items: [{ docId: 'b' }] })
      .mockResolvedValue({ Items: [] })
    const adapter = mockAdapter({ send })
    const ids = await queryGeoDocIds(adapter, 'places', 'location', 'near', [
      -122.4194,
      37.7749,
      500_000,
    ])
    expect(ids?.has('a')).toBe(true)
    expect(ids?.has('b')).toBe(true)
  })

  it('queries intersects via bounding box', async () => {
    const send = vi.fn().mockResolvedValue({ Items: [{ docId: 'z' }] })
    const adapter = mockAdapter({ send })
    const ring = [
      [-123, 38],
      [-121, 38],
      [-121, 37],
      [-123, 37],
      [-123, 38],
    ]
    const ids = await queryGeoDocIds(adapter, 'places', 'location', 'intersects', {
      type: 'Polygon',
      coordinates: [ring],
    })
    expect(ids?.has('z')).toBe(true)
  })

  it('queries geo-index for near and returns doc ids', async () => {
    const send = vi.fn().mockResolvedValue({
      Items: [{ docId: 'doc-1', sk: 'DOC#doc-1' }],
    })
    const adapter = mockAdapter({ send })
    const ids = await queryGeoDocIds(adapter, 'places', 'location', 'near', [
      -122.4194,
      37.7749,
      500_000,
    ])
    expect(ids?.has('doc-1')).toBe(true)
    expect(send.mock.calls[0]?.[0].input.IndexName).toBe('geo-index')
  })
})
