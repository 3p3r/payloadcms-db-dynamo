import { describe, expect, it } from 'vitest'

import { extractSearchLikeWhere } from '../../src/utilities/extractSearchWhere.js'

describe('extractSearchLikeWhere', () => {
  const paths = ['title', 'slug']

  it('returns null for unsupported shapes', () => {
    expect(extractSearchLikeWhere(undefined, paths)).toBeNull()
    expect(extractSearchLikeWhere({}, paths)).toBeNull()
    expect(extractSearchLikeWhere({ title: { equals: 'x' } }, paths)).toBeNull()
    expect(extractSearchLikeWhere({ or: [{ title: { like: 'ab' } }] }, paths)).toBeNull()
    expect(extractSearchLikeWhere({ title: { like: '   ' } }, paths)).toBeNull()
    expect(
      extractSearchLikeWhere(
        { or: [{ title: { like: 'foo' } }, { slug: { like: 'bar' } }] },
        paths,
      ),
    ).toBeNull()
    expect(extractSearchLikeWhere({ or: [null] } as never, paths)).toBeNull()
    expect(
      extractSearchLikeWhere({ or: [{ title: { like: 'foo' }, slug: { like: 'foo' } }] }, paths),
    ).toBeNull()
    expect(extractSearchLikeWhere({ title: { like: 'foo' } }, ['other'])).toBeNull()
  })

  it('parses contains and not_like on searchable fields', () => {
    expect(extractSearchLikeWhere({ title: { contains: 'foo' } }, paths)?.operator).toBe('contains')
    expect(extractSearchLikeWhere({ title: { not_like: 'foo' } }, paths)?.operator).toBe('not_like')
  })

  it('includes remainder when or group has extra top-level keys', () => {
    const plan = extractSearchLikeWhere(
      {
        or: [{ title: { like: 'foo' } }, { slug: { like: 'foo' } }],
        active: { equals: true },
      } as never,
      paths,
    )
    expect(plan?.remainder).toEqual({ active: { equals: true } })
  })
})
