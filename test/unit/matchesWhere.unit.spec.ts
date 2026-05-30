import { describe, expect, it } from 'vitest'

import { matchesWhere } from '../../src/utilities/matchesWhere.js'
import { unsupportedOperatorError } from '../../src/utilities/operators.js'

const sf = { longitude: -122.4194, latitude: 37.7749 }

describe('matchesWhere', () => {
  const item = {
    title: 'Hello',
    count: 5,
    tags: ['a', 'b'],
    nested: { x: 1 },
    location: [-122.4194, 37.7749],
  }

  it('matches comparisons and existence', () => {
    expect(matchesWhere(item, { title: { equals: 'Hello' } })).toBe(true)
    expect(matchesWhere(item, { title: { not_equals: 'x' } })).toBe(true)
    expect(matchesWhere(item, { count: { greater_than: 3 } })).toBe(true)
    expect(matchesWhere(item, { count: { less_than_equal: 5 } })).toBe(true)
    expect(matchesWhere(item, { missing: { exists: false } })).toBe(true)
    expect(matchesWhere(item, { title: { exists: true } })).toBe(true)
  })

  it('matches in, not_in, like, contains, all', () => {
    expect(matchesWhere(item, { count: { in: [5, 6] } })).toBe(true)
    expect(matchesWhere(item, { count: { not_in: [99] } })).toBe(true)
    expect(matchesWhere(item, { title: { like: 'ell' } })).toBe(true)
    expect(matchesWhere(item, { title: { not_like: 'zzz' } })).toBe(true)
    expect(matchesWhere(item, { tags: { contains: 'a' } })).toBe(true)
    expect(matchesWhere(item, { tags: { all: ['a', 'b'] } })).toBe(true)
  })

  it('fails or when no branch matches', () => {
    expect(
      matchesWhere(item, {
        or: [{ title: { equals: 'nope' } }, { count: { equals: 99 } }],
      }),
    ).toBe(false)
  })

  it('matches and / or', () => {
    expect(
      matchesWhere(item, {
        and: [{ title: { equals: 'Hello' } }, { count: { equals: 5 } }],
      }),
    ).toBe(true)
    expect(
      matchesWhere(item, {
        or: [{ title: { equals: 'nope' } }, { count: { equals: 5 } }],
      }),
    ).toBe(true)
  })

  it('ignores malformed and/or clauses', () => {
    expect(matchesWhere(item, { and: 'not-array' as never, title: { equals: 'Hello' } })).toBe(true)
    expect(matchesWhere(item, { or: null as never, title: { equals: 'Hello' } })).toBe(true)
  })

  it('matches geo operators', () => {
    expect(
      matchesWhere(item, {
        location: { near: [-122.4194, 37.7749, 1000] },
      }),
    ).toBe(true)
    const ring = [
      [
        [-122.5, 37.7],
        [-122.3, 37.7],
        [-122.3, 37.9],
        [-122.5, 37.9],
        [-122.5, 37.7],
      ],
    ]
    expect(
      matchesWhere(item, {
        location: { within: { coordinates: ring } },
      }),
    ).toBe(true)
    expect(
      matchesWhere(item, {
        location: { intersects: { $geometry: { coordinates: ring } } },
      }),
    ).toBe(true)
  })

  it('rejects unsupported operators', () => {
    expect(() => matchesWhere(item, { title: { unknown_op: 1 } as never })).toThrow(
      unsupportedOperatorError('unknown_op', 'title').message,
    )
  })

  it('returns true for empty where', () => {
    expect(matchesWhere(item, undefined)).toBe(true)
  })
})
