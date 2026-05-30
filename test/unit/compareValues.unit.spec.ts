import { describe, expect, it } from 'vitest'

import { compareValues, compareValuesLoose } from '../../src/utilities/compareValues.js'

describe('compareValues', () => {
  it('orders nullish before defined values', () => {
    expect(compareValues(null, 'a')).toBe(-1)
    expect(compareValues('a', null)).toBe(1)
  })

  it('compareValuesLoose yields NaN for nullish pairs', () => {
    expect(Number.isNaN(compareValuesLoose(null, 1))).toBe(true)
    expect(Number.isNaN(compareValuesLoose(undefined, undefined))).toBe(true)
  })

  it('compares strings and equal nullish pairs', () => {
    expect(compareValues(undefined, undefined)).toBe(0)
    expect(compareValues('b', 'a')).toBe(1)
    expect(compareValues('a', 'b')).toBe(-1)
    expect(compareValues('same', 'same')).toBe(0)
    expect(compareValues(1, 2)).toBe(-1)
  })
})
