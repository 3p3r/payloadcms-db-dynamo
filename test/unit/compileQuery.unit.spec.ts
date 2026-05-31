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

  it('plans inverted equals with remainder', () => {
    expect(
      compileQuery(adapter, 'items', {
        email: { equals: 'a@b.c' },
        title: { equals: 'z' },
      }),
    ).toMatchObject({
      kind: 'inverted',
      remainder: { title: { equals: 'z' } },
    })
  })

  it('plans geo for point near', () => {
    expect(
      compileQuery(adapter, 'places', {
        location: { near: [-122, 37, 1000] },
      }),
    ).toMatchObject({ kind: 'geo', field: 'location', operator: 'near' })
  })

  it('prefers geo plan over gsi1 list when both apply', () => {
    expect(
      compileQuery(adapter, 'places', {
        location: { near: [-122, 37, 1000] },
        status: { equals: 'open' },
      }),
    ).toMatchObject({ kind: 'geo' })
  })

  it('plans gsi1 list with pushable filter on non-indexed field', () => {
    expect(compileQuery(adapter, 'items', { title: { equals: 'x' } })).toEqual({
      kind: 'gsi1-list',
      collection: 'items',
      partition: 'items',
      where: { title: { equals: 'x' } },
    })
  })

  it('plans inverted-in for indexed in', () => {
    expect(
      compileQuery(adapter, 'items', { email: { in: ['a@b.c', 'c@d.e'] } }),
    ).toMatchObject({
      kind: 'inverted-in',
      field: 'email',
      values: ['a@b.c', 'c@d.e'],
    })
  })

  it('uses partition query for version partitions without where', () => {
    expect(
      compileQuery(adapter, 'header_versions', undefined, { partition: 'header_versions' }),
    ).toEqual({
      kind: 'partition',
      partition: 'header_versions',
      where: undefined,
    })
  })

  it('plans version-latest gsi1 for latest equals true', () => {
    expect(
      compileQuery(adapter, 'posts', { latest: { equals: true } }, { partition: 'posts_versions' }),
    ).toMatchObject({ kind: 'version-latest-gsi1', collection: 'posts' })
  })

  it('plans version-parent gsi1 for parent equals', () => {
    expect(
      compileQuery(
        adapter,
        'posts',
        { parent: { equals: 'p1' } },
        { partition: 'posts_versions' },
      ),
    ).toMatchObject({ kind: 'version-parent-gsi1', collection: 'posts', parentId: 'p1' })
  })

  it('falls back to partition when version filter is not pushable', () => {
    expect(
      compileQuery(
        adapter,
        'posts',
        { latest: { equals: true }, note: { like: 'draft' } },
        { partition: 'posts_versions' },
      ),
    ).toMatchObject({ kind: 'partition', partition: 'posts_versions' })
  })

  it('plans gsi1 list without where property when filter is empty', () => {
    expect(compileQuery(adapter, 'items', {})).toMatchObject({
      kind: 'gsi1-list',
      collection: 'items',
    })
  })

  it('plans inverted-in with remainder', () => {
    expect(
      compileQuery(adapter, 'items', {
        email: { in: ['a@b.c'] },
        title: { equals: 'x' },
      }),
    ).toMatchObject({
      kind: 'inverted-in',
      field: 'email',
      remainder: { title: { equals: 'x' } },
    })
  })

  it('uses partition for version parent without equals', () => {
    expect(
      compileQuery(adapter, 'posts', { parent: { in: ['p1'] } }, { partition: 'posts_versions' }),
    ).toMatchObject({ kind: 'partition' })
  })

  it('uses partition when latest is not true', () => {
    expect(
      compileQuery(adapter, 'posts', { latest: { equals: false } }, { partition: 'posts_versions' }),
    ).toMatchObject({ kind: 'partition' })
  })

  it('uses partition when indexed in is empty', () => {
    expect(compileQuery(adapter, 'items', { email: { in: [] } })).toMatchObject({
      kind: 'partition',
      where: { email: { in: [] } },
    })
  })

  it('uses partition for version id lookup', () => {
    expect(
      compileQuery(adapter, 'posts', { id: { equals: 'v1' } }, { partition: 'posts_versions' }),
    ).toMatchObject({ kind: 'partition', partition: 'posts_versions' })
  })
})
