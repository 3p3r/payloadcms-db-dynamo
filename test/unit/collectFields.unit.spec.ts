import { describe, expect, it } from 'vitest'

import {
  collectDeclaredIndexPaths,
  collectIndexPaths,
  collectPointFields,
} from '../../src/schema/collectFields.js'

describe('collectFields', () => {
  it('collects point field paths including nested groups', () => {
    const paths = collectPointFields([
      { name: 'title', type: 'text' },
      { name: 'loc', type: 'point' },
      {
        name: 'meta',
        type: 'group',
        fields: [{ name: 'pin', type: 'point' }],
      },
    ] as never)
    expect(paths).toContain('loc')
    expect(paths).toContain('meta.pin')
  })

  it('collects index paths from sanitizedIndexes and fields', () => {
    const paths = collectIndexPaths({
      slug: 'posts',
      fields: [{ name: 'email', type: 'email', unique: true }],
      sanitizedIndexes: [
        { fields: ['title'] },
        { fields: [{ name: 'slug' } as never] },
        { fields: [{ path: 'meta.code' } as never] },
      ],
    } as never)
    expect(paths).toContain('title')
    expect(paths).toContain('slug')
    expect(paths).toContain('meta.code')
    expect(paths).toContain('email')
  })

  it('collectDeclaredIndexPaths only uses sanitizedIndexes', () => {
    const paths = collectDeclaredIndexPaths({
      slug: 'posts',
      fields: [{ name: 'email', type: 'email' }],
      sanitizedIndexes: [{ fields: ['title'] }],
    } as never)
    expect(paths).toEqual(['title'])
  })

  it('skips unnamed fields and non-point siblings inside groups', () => {
    const paths = collectPointFields([
      { type: 'row', fields: [{ name: 'pin', type: 'point' }] },
      {
        name: 'wrap',
        type: 'group',
        fields: [
          { name: 'title', type: 'text' },
          { name: 'inner', type: 'point' },
        ],
      },
    ] as never)
    expect(paths).toEqual(['wrap.inner'])
  })
})
