import { describe, expect, it } from 'vitest'

import {
  getCollectionFields,
  getGlobalFields,
  projectForCollection,
  projectForGlobal,
  projectVersionRow,
  projectVersionSnapshot,
} from '../../src/utilities/resolveSchema.js'
import { mockAdapter } from '../__helpers/mockAdapter.js'

const schemaPayload = {
  collections: {
    posts: {
      config: {
        slug: 'posts',
        fields: [{ name: 'title', type: 'text' }],
      },
    },
  },
  config: {
    globals: [{ slug: 'site', fields: [{ name: 'name', type: 'text' }] }],
  },
} as never

describe('resolveSchema projection', () => {
  const adapter = mockAdapter({ payload: schemaPayload })

  it('projects collection, global, and version rows', () => {
    expect(projectForCollection(adapter, 'posts', { title: 't', extra: 'drop' }).title).toBe('t')
    expect(projectForCollection(adapter, 'posts', { title: 't', extra: 'drop' }).extra).toBeUndefined()

    expect(projectForGlobal(adapter, 'site', { name: 'n', leak: true }).name).toBe('n')

    expect(
      projectVersionRow(adapter, { kind: 'global', slug: 'site' }, {
        id: 'v1',
        version: { name: 'inner' },
        extra: 'drop',
      }).version,
    ).toEqual({ name: 'inner' })

    expect(
      projectVersionRow(adapter, { kind: 'collection', slug: 'posts' }, {
        id: 'v1',
        version: { title: 't' },
      }).version,
    ).toEqual({ title: 't' })

    expect(
      projectVersionSnapshot(adapter, { kind: 'collection', slug: 'posts' }, { title: 's' }),
    ).toEqual({ title: 's' })
  })

  it('throws for unknown collection, global, or version parent slugs', () => {
    expect(() => projectForCollection(adapter, 'missing', { x: 1 })).toThrow(/unknown collection/)
    expect(() => projectForGlobal(adapter, 'missing', { x: 1 })).toThrow(/unknown global/)
    expect(() =>
      projectVersionRow(adapter, { kind: 'collection', slug: 'missing' }, { id: '1' }),
    ).toThrow(/unknown collection/)
    expect(() =>
      projectVersionSnapshot(adapter, { kind: 'global', slug: 'ghost' }, { x: 1 }),
    ).toThrow(/unknown global/)
  })

  it('returns null field lists for unknown slugs and malformed globals config', () => {
    expect(getCollectionFields(adapter, 'missing')).toBeNull()
    const badGlobals = mockAdapter({ payload: { config: { globals: 'not-array' as never } } })
    expect(getGlobalFields(badGlobals, 'site')).toBeNull()
  })
})
