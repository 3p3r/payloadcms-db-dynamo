import { describe, expect, it } from 'vitest'

import { whereHasJsOnlyOperator } from '../../src/utilities/operators.js'

describe('operators', () => {
  it('whereHasJsOnlyOperator recurses and detects like', () => {
    expect(whereHasJsOnlyOperator({ title: { like: 'x' } })).toBe(true)
    expect(whereHasJsOnlyOperator({ title: { equals: 'x' } })).toBe(false)
    expect(
      whereHasJsOnlyOperator({
        and: [{ title: { equals: 'a' } }, { body: { like: 'b' } }],
      }),
    ).toBe(true)
    expect(
      whereHasJsOnlyOperator({
        or: [{ title: { equals: 'a' } }, { body: { contains: 'b' } }],
      }),
    ).toBe(true)
    expect(whereHasJsOnlyOperator(undefined)).toBe(false)
    expect(whereHasJsOnlyOperator({ and: 'not-an-array' })).toBe(false)
    expect(whereHasJsOnlyOperator({ title: 'plain' })).toBe(false)
    expect(whereHasJsOnlyOperator({ and: [null, { title: { like: 'x' } }] })).toBe(true)
  })
})
