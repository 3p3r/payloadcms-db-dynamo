import { describe, expect, it } from 'vitest'

import { extractSearchLikeWhere } from '../../src/utilities/extractSearchWhere.js'

describe('extractSearchLikeWhere', () => {
  const paths = ['title', 'slug']
  const ngramLength = 3

  it('returns null for unsupported shapes', () => {
    expect(extractSearchLikeWhere(undefined, paths, ngramLength)).toBeNull()
    expect(extractSearchLikeWhere({}, paths, ngramLength)).toBeNull()
    expect(extractSearchLikeWhere({ title: { equals: 'x' } }, paths, ngramLength)).toBeNull()
    expect(extractSearchLikeWhere({ or: [{ title: { like: 'ab' } }] }, paths, ngramLength)).toBeNull()
    expect(extractSearchLikeWhere({ title: { like: '   ' } }, paths, ngramLength)).toBeNull()
    expect(
      extractSearchLikeWhere(
        { or: [{ title: { like: 'foo' } }, { slug: { like: 'bar' } }] },
        paths,
        ngramLength,
      ),
    ).toBeNull()
    expect(extractSearchLikeWhere({ or: [null] } as never, paths, ngramLength)).toBeNull()
    expect(
      extractSearchLikeWhere(
        { or: [{ title: { like: 'foo' }, slug: { like: 'foo' } }] },
        paths,
        ngramLength,
      ),
    ).toBeNull()
    expect(extractSearchLikeWhere({ title: { like: 'foo' } }, ['other'], ngramLength)).toBeNull()
  })

  it('parses contains and not_like on searchable fields', () => {
    expect(extractSearchLikeWhere({ title: { contains: 'foo' } }, paths, ngramLength)?.operator).toBe(
      'contains',
    )
    expect(extractSearchLikeWhere({ title: { not_like: 'foo' } }, paths, ngramLength)?.operator).toBe(
      'not_like',
    )
  })

  it('includes remainder when or group has extra top-level keys', () => {
    const plan = extractSearchLikeWhere(
      {
        or: [{ title: { like: 'foo' } }, { slug: { like: 'foo' } }],
        active: { equals: true },
      } as never,
      paths,
      ngramLength,
    )
    expect(plan?.remainder).toEqual({ active: { equals: true } })
  })
})
