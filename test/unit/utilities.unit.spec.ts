import { describe, expect, it } from 'vitest'

import { getByPath } from '../../src/utilities/getByPath.js'
import { whereToId } from '../../src/utilities/whereToId.js'
import { unsupportedOperatorError, whereHasJsOnlyOperator } from '../../src/utilities/operators.js'

describe('utilities', () => {
  it('getByPath reads nested paths', () => {
    expect(getByPath({ a: { b: 1 } }, 'a.b')).toBe(1)
    expect(getByPath({ a: 1 }, 'a.c')).toBeUndefined()
    expect(getByPath({ a: 1 }, 'a.b.c')).toBeUndefined()
    expect(getByPath(null, 'a')).toBeUndefined()
  })

  it('whereToId extracts id from equals only', () => {
    expect(whereToId(undefined)).toBeNull()
    expect(whereToId({ id: { equals: 'abc' } })).toBe('abc')
    expect(whereToId({ and: [{ id: { equals: 42 } }] })).toBe(42)
    expect(whereToId({ and: [{ id: { equals: 'a' } }, { id: { equals: 'b' } }] })).toBeNull()
    expect(whereToId({ id: null as never })).toBeNull()
    expect(whereToId({ id: { equals: true as never } })).toBeNull()
    expect(whereToId({ id: { in: ['x'] } })).toBeNull()
    expect(whereToId({ title: { equals: 'x' } })).toBeNull()
    expect(whereToId({ id: { not_equals: '1' } })).toBeNull()
  })

  it('unsupportedOperatorError formats message', () => {
    const err = unsupportedOperatorError('foo', 'bar')
    expect(err.message).toContain('foo')
    expect(err.message).toContain('bar')
  })

  it('whereHasJsOnlyOperator skips malformed groups', () => {
    expect(whereHasJsOnlyOperator({ and: 'x' as never, title: { equals: 'a' } })).toBe(false)
    expect(whereHasJsOnlyOperator({ title: null as never })).toBe(false)
    expect(whereHasJsOnlyOperator({ or: [{ title: { near: [1, 2, 3] } }] })).toBe(false)
    expect(whereHasJsOnlyOperator({ and: [{ location: { near: [1, 2, 3] } }] })).toBe(false)
    expect(whereHasJsOnlyOperator({ and: [null, { title: { like: 'x' } }] } as never)).toBe(true)
    expect(whereHasJsOnlyOperator({ or: 'bad' as never, title: { equals: 'a' } })).toBe(false)
  })
})
