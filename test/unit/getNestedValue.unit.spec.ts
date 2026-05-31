import { describe, expect, it } from 'vitest'

import { getNestedValue } from '../../src/utilities/getNestedValue.js'

describe('getNestedValue', () => {
  it('reads nested paths and stops on missing segments', () => {
    expect(getNestedValue({ a: { b: 1 } }, 'a.b')).toBe(1)
    expect(getNestedValue({ a: 1 }, 'a.b')).toBeUndefined()
    expect(getNestedValue({ a: null }, 'a.b')).toBeUndefined()
  })
})
