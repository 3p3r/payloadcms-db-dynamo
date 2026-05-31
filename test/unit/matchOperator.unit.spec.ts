import { describe, expect, it } from 'vitest'

import {
  extractPolygonRing,
  MATCH_OPERATORS,
  matchOperator,
} from '../../src/utilities/matchOperator.js'

describe('matchOperator', () => {
  const ring = [
    [
      [-122.5, 37.7],
      [-122.3, 37.7],
      [-122.3, 37.9],
      [-122.5, 37.9],
      [-122.5, 37.7],
    ],
  ]

  it('covers every registered operator', () => {
    expect(matchOperator(1, 'equals', 1)).toBe(true)
    expect(matchOperator(1, 'not_equals', 2)).toBe(true)
    expect(matchOperator(5, 'greater_than', 3)).toBe(true)
    expect(matchOperator(5, 'greater_than_equal', 5)).toBe(true)
    expect(matchOperator(2, 'less_than', 3)).toBe(true)
    expect(matchOperator(2, 'less_than_equal', 2)).toBe(true)
    expect(matchOperator('x', 'exists', true)).toBe(true)
    expect(matchOperator(undefined, 'exists', false)).toBe(true)
    expect(matchOperator('a', 'in', ['a', 'b'])).toBe(true)
    expect(matchOperator('z', 'not_in', ['a'])).toBe(true)
    expect(matchOperator('hello', 'like', 'ell')).toBe(true)
    expect(matchOperator('hello', 'not_like', 'zzz')).toBe(true)
    expect(matchOperator('', 'like', '')).toBe(true)
    expect(matchOperator(123, 'like', 'x')).toBe(false)
    expect(matchOperator(['a'], 'contains', 'a')).toBe(true)
    expect(matchOperator('abc', 'contains', 'b')).toBe(true)
    expect(matchOperator(['a', 'b'], 'all', ['a', 'b'])).toBe(true)
    expect(matchOperator([-122.4194, 37.7749], 'near', [-122.4194, 37.7749, 5000])).toBe(true)
    expect(matchOperator([-122.4194, 37.7749], 'within', { coordinates: ring })).toBe(true)
    expect(matchOperator([-122.4194, 37.7749], 'intersects', { $geometry: { coordinates: ring } })).toBe(
      true,
    )
    expect(matchOperator('x', 'bogus', 1)).toBe(false)
    expect(matchOperator(123, 'not_like', 'x')).toBe(true)
    expect(matchOperator({}, 'contains', 'x')).toBe(false)
    expect(matchOperator([0, 0], 'near', [0, 0, 1])).toBe(true)
    expect(matchOperator([0, 0], 'near', [10, 10, 1])).toBe(false)
    expect(matchOperator([0, 0], 'within', { coordinates: [[[0, 0], [1, 0], [0, 1], [0, 0]]] })).toBe(
      true,
    )
    expect(matchOperator([5, 5], 'within', { coordinates: [[[0, 0], [1, 0], [0, 1], [0, 0]]] })).toBe(
      false,
    )
    expect(matchOperator(null, 'within', { coordinates: 'bad' })).toBe(false)
    expect(matchOperator([-122.4194, 37.7749], 'within', { coordinates: [[[0, 0], [1, 0]]] })).toBe(
      false,
    )
    expect(matchOperator(undefined, 'exists', false)).toBe(true)
    expect(matchOperator(['only-a'], 'all', ['a', 'b'])).toBe(false)
    expect(matchOperator([0, 0], 'intersects', { coordinates: [[0, 0], [1, 0], 'bad'] })).toBe(
      false,
    )
    expect(matchOperator([0, 0], 'near', [0, 0, 1, 100])).toBe(false)
    expect(matchOperator([0, 0], 'near', [0, 0, 100, 50])).toBe(false)
    expect(matchOperator(null, 'within', null)).toBe(false)
    expect(matchOperator('not-a-point', 'within', { coordinates: [[[0, 0], [1, 0], [0, 1], [0, 0]]] })).toBe(
      false,
    )
    expect(
      matchOperator([0, 0], 'within', {
        coordinates: [
          [[0, 0], [1, 0], [0, 1], [0, 0]],
        ],
      }),
    ).toBe(true)
  })

  it('extractPolygonRing accepts GeoJSON rings and flat coordinate lists', () => {
    const fromMulti = extractPolygonRing(ring)
    expect(fromMulti?.length).toBeGreaterThanOrEqual(3)
    expect(extractPolygonRing([[-122.5, 37.7], [-122.3, 37.7], [-122.3, 37.9]])).not.toBeNull()
    expect(extractPolygonRing(null)).toBeNull()
    expect(extractPolygonRing([['a', 'b']])).toBeNull()
  })

  it('exports a handler per supported operator name', () => {
    for (const name of Object.keys(MATCH_OPERATORS)) {
      expect(typeof MATCH_OPERATORS[name]).toBe('function')
    }
  })
})
