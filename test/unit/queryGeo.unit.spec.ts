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

  it('extracts geo from and without sibling remainder', () => {
    const clause = extractGeoClause({
      and: [{ location: { near: [1, 2, 3] } }],
    } as never)
    expect(clause?.remainder).toBeUndefined()
  })

  it('extracts geo with top-level remainder after and group', () => {
    const clause = extractGeoClause({
      and: [{ location: { near: [1, 2, 3] } }],
      status: { equals: 'open' },
    } as never)
    expect(clause?.field).toBe('location')
    expect(clause?.remainder).toEqual({ status: { equals: 'open' } })
  })

  it('extracts geo nested in or', () => {
    const clause = extractGeoClause({
      or: [{ location: { within: { coordinates: [] } } }, { name: { equals: 'x' } }],
    } as never)
    expect(clause?.operator).toBe('within')
    expect(clause?.remainder).toEqual({ name: { equals: 'x' } })
  })

  it('wraps multiple or siblings in remainder', () => {
    const clause = extractGeoClause({
      or: [
        { location: { intersects: { type: 'Polygon' } } },
        { name: { equals: 'a' } },
        { status: { equals: 'b' } },
      ],
    } as never)
    expect(clause?.operator).toBe('intersects')
    expect(clause?.remainder?.or).toHaveLength(2)
  })

  it('extracts geo nested in and with sibling remainder', () => {
    const clause = extractGeoClause({
      and: [{ location: { near: [1, 2, 3] } }, { name: { equals: 'SF' } }],
    } as never)
    expect(clause?.field).toBe('location')
    expect(clause?.operator).toBe('near')
    expect(clause?.remainder).toEqual({ name: { equals: 'SF' } })
  })

  it('wraps multiple and siblings in remainder', () => {
    const clause = extractGeoClause({
      and: [
        { location: { near: [1, 2, 3] } },
        { name: { equals: 'a' } },
        { status: { equals: 'b' } },
      ],
    } as never)
    expect(clause?.remainder?.and).toHaveLength(2)
  })

  it('returns null when where has no geo operator', () => {
    expect(extractGeoClause({ title: { equals: 'a' } })).toBeNull()
    expect(extractGeoClause(undefined)).toBeNull()
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
