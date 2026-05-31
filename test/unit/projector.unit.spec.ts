import { describe, expect, it } from 'vitest'

import {
  mainItemKeys,
  projectCollectionIndexDeletes,
  projectCollectionIndexes,
} from '../../src/index/projector.js'
import { mockAdapter } from '../__helpers/mockAdapter.js'

describe('index/projector', () => {
  const adapter = mockAdapter({
    resolvePartition: (slug: string) => slug,
    payload: {
      collections: {
        places: {
          config: {
            fields: [
              { name: 'name', type: 'text' },
              { name: 'location', type: 'point' },
            ],
            sanitizedIndexes: [{ fields: ['name'], unique: true }],
          },
        },
      },
      config: { globals: [] },
    } as never,
  })

  it('mainItemKeys uses collection partition', () => {
    expect(mainItemKeys(adapter, 'places', '9')).toEqual({ pk: 'places', sk: '9' })
  })

  it('projects gsi1, inverted, and geo rows on create', () => {
    const doc = {
      id: '1',
      name: 'SF',
      location: [-122.4194, 37.7749],
      createdAt: 't',
      updatedAt: 't',
    }
    const { mainAttributes, puts, deletes } = projectCollectionIndexes(adapter, 'places', doc, null)
    expect(mainAttributes.gsi1pk).toBe('COL#places#LIST')
    expect(puts.some((p) => String(p['pk']).startsWith('IDX#'))).toBe(true)
    expect(puts.some((p) => String(p['pk']).startsWith('GEO#'))).toBe(true)
    expect(deletes).toHaveLength(0)
  })

  it('omits inverted row when indexed value is empty', () => {
    const doc = { id: '1', name: '', createdAt: 't', updatedAt: 't' }
    const { puts } = projectCollectionIndexes(adapter, 'places', doc, null)
    expect(puts.some((p) => String(p['pk']).startsWith('IDX#'))).toBe(false)
  })

  it('skips inverted churn when indexed value is unchanged', () => {
    const doc = { id: '1', name: 'Same', createdAt: 't', updatedAt: 't' }
    const { deletes, puts } = projectCollectionIndexes(adapter, 'places', doc, { ...doc })
    expect(deletes.filter((d) => d.pk.startsWith('IDX#'))).toHaveLength(0)
    expect(puts.filter((p) => String(p['pk']).startsWith('IDX#'))).toHaveLength(0)
  })

  it('deletes inverted row when indexed value is cleared', () => {
    const before = { id: '1', name: 'Was', createdAt: 't', updatedAt: 't' }
    const after = { id: '1', name: '', createdAt: 't', updatedAt: 't' }
    const { deletes, puts } = projectCollectionIndexes(adapter, 'places', after, before)
    expect(deletes.some((d) => d.pk.includes('Was'))).toBe(true)
    expect(puts.some((p) => String(p['pk']).startsWith('IDX#'))).toBe(false)
  })

  it('deletes geo row when point is removed', () => {
    const before = {
      id: '1',
      name: 'X',
      location: [-122, 37],
      createdAt: 't',
      updatedAt: 't',
    }
    const after = { id: '1', name: 'X', createdAt: 't', updatedAt: 't' }
    const { deletes, puts } = projectCollectionIndexes(adapter, 'places', after, before)
    expect(deletes.some((d) => String(d.pk).startsWith('GEO#'))).toBe(true)
    expect(puts.some((p) => String(p['pk']).startsWith('GEO#'))).toBe(false)
  })

  it('works when collection config is missing on adapter', () => {
    const bare = mockAdapter({ payload: { collections: {}, config: { globals: [] } } as never })
    const doc = { id: '1', title: 't', createdAt: 't', updatedAt: 't' }
    const { mainAttributes } = projectCollectionIndexes(bare, 'unknown', doc, null)
    expect(mainAttributes.gsi1pk).toBe('COL#unknown#LIST')
  })

  it('deletes stale inverted and geo keys on update', () => {
    const before = {
      id: '1',
      name: 'Old',
      location: [-118, 34],
      createdAt: 't',
      updatedAt: 't',
    }
    const after = {
      id: '1',
      name: 'New',
      location: [-122.4194, 37.7749],
      createdAt: 't',
      updatedAt: 't',
    }
    const { deletes, puts } = projectCollectionIndexes(adapter, 'places', after, before)
    expect(deletes.length).toBeGreaterThan(0)
    expect(puts.length).toBeGreaterThan(0)
    const delKeys = projectCollectionIndexDeletes(adapter, 'places', before)
    expect(delKeys.length).toBeGreaterThan(0)
  })
})
