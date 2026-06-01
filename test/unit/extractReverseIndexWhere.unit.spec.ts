import { describe, expect, it } from 'vitest'

import { extractReverseIndexWhere } from '../../src/utilities/extractReverseIndexWhere.js'

describe('extractReverseIndexWhere', () => {
  const paths = ['email']

  it('extracts exists true on declared index', () => {
    expect(extractReverseIndexWhere({ email: { exists: true } }, paths)).toEqual({
      field: 'email',
      mode: 'exists',
    })
    expect(
      extractReverseIndexWhere({ email: { exists: true }, active: { equals: true } }, paths),
    ).toEqual({
      field: 'email',
      mode: 'exists',
      remainder: { active: { equals: true } },
    })
  })

  it('extracts not_equals with remainder', () => {
    expect(
      extractReverseIndexWhere({ email: { not_equals: 'a' }, title: { equals: 'x' } }, paths),
    ).toEqual({
      field: 'email',
      mode: 'not_equals',
      excludeValue: 'a',
      remainder: { title: { equals: 'x' } },
    })
  })

  it('extracts not_in', () => {
    expect(extractReverseIndexWhere({ email: { not_in: ['a', 'b'] } }, paths)).toEqual({
      field: 'email',
      mode: 'not_in',
      excludeValues: ['a', 'b'],
    })
  })

  it('ignores exists false and empty not_in', () => {
    expect(extractReverseIndexWhere({ email: { exists: false } }, paths)).toBeNull()
    expect(extractReverseIndexWhere({ email: { not_in: [] } }, paths)).toBeNull()
    expect(extractReverseIndexWhere({ email: { not_equals: undefined } }, paths)).toBeNull()
  })

  it('matches the first applicable declared index field in path order', () => {
    expect(
      extractReverseIndexWhere(
        { title: { equals: 'x' }, email: { exists: true } },
        ['title', 'email'],
      ),
    ).toEqual({
      field: 'email',
      mode: 'exists',
      remainder: { title: { equals: 'x' } },
    })
  })

  it('returns null for empty input or non-index fields', () => {
    expect(extractReverseIndexWhere(undefined, paths)).toBeNull()
    expect(extractReverseIndexWhere({}, paths)).toBeNull()
    expect(extractReverseIndexWhere({ email: { exists: true } }, [])).toBeNull()
    expect(extractReverseIndexWhere({ title: { exists: true } }, paths)).toBeNull()
    expect(extractReverseIndexWhere({ email: 'raw' }, paths)).toBeNull()
  })
})
