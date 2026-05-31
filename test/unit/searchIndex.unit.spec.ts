import { describe, expect, it } from 'vitest'

import { projectSearchIndex } from '../../src/index/projectSearchIndex.js'
import {
  normalizeSearchText,
  searchNgrams,
  collectSearchIndexPaths,
} from '../../src/schema/searchIndex.js'
import { resolveAdapterConfig } from '../../src/config.js'
import { mockAdapter } from '../__helpers/mockAdapter.js'

describe('searchIndex', () => {
  it('normalizeSearchText lowercases and collapses whitespace', () => {
    expect(normalizeSearchText('  Hello   World  ')).toBe('hello world')
  })

  it('searchNgrams emits overlapping grams of configured length', () => {
    const n = resolveAdapterConfig().searchNgramLength
    expect(n).toBe(3)
    expect(searchNgrams('robot', n)).toEqual(['rob', 'obo', 'bot'])
    expect(searchNgrams('ab', n)).toEqual([])
    expect(searchNgrams('', n)).toEqual([])
  })

  it('collectSearchIndexPaths merges listSearchableFields and useAsTitle', () => {
    const paths = collectSearchIndexPaths({
      slug: 'posts',
      fields: [],
      admin: {
        listSearchableFields: ['title'],
        useAsTitle: 'slug',
      },
    } as never)
    expect(paths.sort()).toEqual(['slug', 'title'])
  })

  it('collectSearchIndexPaths returns empty when searchIndex is false', () => {
    expect(
      collectSearchIndexPaths({
        slug: 'posts',
        fields: [],
        admin: { listSearchableFields: ['title'], searchIndex: false },
      } as never),
    ).toEqual([])
  })

  it('projectSearchIndex writes puts and deletes on field change', () => {
    const adapter = mockAdapter({
      payload: {
        collections: {
          posts: {
            config: {
              slug: 'posts',
              fields: [{ name: 'title', type: 'text' }],
              admin: { listSearchableFields: ['title'] },
            },
          },
        },
        config: { globals: [] },
      } as never,
    })

    const before = { id: '1', title: 'robot' }
    const after = { id: '1', title: 'cars' }
    const delta = projectSearchIndex(adapter, 'posts', after, before)
    expect(delta.deletes.some((k) => k.pk.includes('#rob'))).toBe(true)
    expect(delta.puts.some((p) => String(p.pk).includes('#car'))).toBe(true)
  })

  it('does not delete and put the same n-gram key in one delta', () => {
    const adapter = mockAdapter({
      payload: {
        collections: {
          posts: {
            config: {
              slug: 'posts',
              fields: [{ name: 'title', type: 'text' }],
              admin: { listSearchableFields: ['title'] },
            },
          },
        },
        config: { globals: [] },
      } as never,
    })

    const delta = projectSearchIndex(adapter, 'posts', { id: '1', title: 'robotics' }, { id: '1', title: 'robot' })
    const deleteKeys = new Set(delta.deletes.map((k) => `${k.pk}\0${k.sk}`))
    for (const put of delta.puts) {
      expect(deleteKeys.has(`${put.pk}\0${put.sk}`)).toBe(false)
    }
    expect(delta.puts.some((p) => String(p.pk).includes('#rob'))).toBe(true)
  })
})
