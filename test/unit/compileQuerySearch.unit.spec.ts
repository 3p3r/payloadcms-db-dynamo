import { describe, expect, it } from 'vitest'

import { compileQuery } from '../../src/utilities/compileQuery.js'
import { extractSearchLikeWhere } from '../../src/utilities/extractSearchWhere.js'
import { mockAdapter } from '../__helpers/mockAdapter.js'

function searchAdapter() {
  return mockAdapter({
    payload: {
      collections: {
        posts: {
          config: {
            slug: 'posts',
            fields: [{ name: 'title', type: 'text' }, { name: 'slug', type: 'text' }],
            admin: {
              listSearchableFields: ['title', 'slug'],
              useAsTitle: 'title',
            },
          },
        },
      },
      config: { globals: [] },
    } as never,
  })
}

describe('compileQuery search-ngram', () => {
  it('extractSearchLikeWhere parses single like and or groups', () => {
    const paths = ['title', 'slug']
    expect(extractSearchLikeWhere({ title: { like: 'foo' } }, paths)?.searchText).toBe('foo')
    expect(
      extractSearchLikeWhere(
        { or: [{ title: { like: 'bar' } }, { slug: { like: 'bar' } }] },
        paths,
      )?.fields.sort(),
    ).toEqual(['slug', 'title'])
    expect(extractSearchLikeWhere({ title: { like: 'ab' } }, paths)).toBeNull()
    expect(extractSearchLikeWhere({ title: { like: '   ' } }, paths)).toBeNull()
  })

  it('compileQuery selects search-ngram for admin search where', () => {
    const adapter = searchAdapter()
    const plan = compileQuery(adapter, 'posts', {
      or: [{ title: { like: 'rob' } }, { slug: { like: 'rob' } }],
    })
    expect(plan.kind).toBe('search-ngram')
    if (plan.kind === 'search-ngram') {
      expect(plan.searchText).toBe('rob')
      expect(plan.fields).toContain('title')
    }
  })

  it('compileQuery falls back to partition for mixed and clauses', () => {
    const adapter = searchAdapter()
    const plan = compileQuery(adapter, 'posts', {
      and: [{ category: { equals: 'x' } }, { title: { like: 'rob' } }],
    })
    expect(plan.kind).toBe('partition')
  })
})
