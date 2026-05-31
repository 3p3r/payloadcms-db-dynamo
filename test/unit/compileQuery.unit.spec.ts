import { describe, expect, it } from 'vitest'

import { compileQuery } from '../../src/utilities/compileQuery.js'
import { mockAdapter } from '../__helpers/mockAdapter.js'

describe('compileQuery', () => {
  const adapter = mockAdapter({
    payload: {
      collections: {
        items: {
          config: {
            fields: [{ name: 'email', type: 'email' }],
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
    } as never,
  })

  it('plans gsi1 list for collection without where', () => {
    expect(compileQuery(adapter, 'items', undefined)).toEqual({
      kind: 'gsi1-list',
      collection: 'items',
      partition: 'items',
    })
  })

  it('plans inverted index for indexed equals', () => {
    expect(compileQuery(adapter, 'items', { email: { equals: 'a@b.c' } })).toMatchObject({
      kind: 'inverted',
      field: 'email',
      value: 'a@b.c',
    })
  })

  it('plans geo for point near', () => {
    expect(
      compileQuery(adapter, 'places', {
        location: { near: [-122, 37, 1000] },
      }),
    ).toMatchObject({ kind: 'geo', field: 'location', operator: 'near' })
  })

  it('plans partition query with generic where', () => {
    expect(compileQuery(adapter, 'items', { title: { equals: 'x' } })).toEqual({
      kind: 'partition',
      partition: 'items',
      where: { title: { equals: 'x' } },
    })
  })

  it('uses partition query for version partitions', () => {
    expect(compileQuery(adapter, 'header_versions', undefined)).toEqual({
      kind: 'partition',
      partition: 'header_versions',
      where: undefined,
    })
  })
})
