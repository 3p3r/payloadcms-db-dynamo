import { describe, expect, it } from 'vitest'

import { whereToId } from '../../src/utilities/whereToId.js'

describe('whereToId', () => {
  it('returns null for non-id-equality shapes', () => {
    expect(whereToId(undefined)).toBeNull()
    expect(whereToId({ title: { equals: 'x' } })).toBeNull()
    expect(whereToId({ id: { in: ['a'] } })).toBeNull()
    expect(whereToId({ and: [{ id: { equals: '1' } }, { title: { equals: 'x' } }] })).toBeNull()
    expect(whereToId({ and: [] })).toBeNull()
    expect(whereToId({ id: null as never })).toBeNull()
    expect(whereToId({ id: { equals: true as never } })).toBeNull()
  })

  it('returns id for direct or single and-wrapped equality', () => {
    expect(whereToId({ id: { equals: 'abc' } })).toBe('abc')
    expect(whereToId({ id: { equals: 42 } })).toBe(42)
    expect(whereToId({ and: [{ id: { equals: 'nested' } }] })).toBe('nested')
  })
})
