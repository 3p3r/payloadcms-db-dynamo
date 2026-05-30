import { describe, expect, it } from 'vitest'

import {
  distanceMeters,
  parseNearOperator,
  parsePoint,
} from '../../src/geo/distance.js'

describe('geo/distance', () => {
  it('parsePoint accepts lng/lat arrays and objects', () => {
    expect(parsePoint([-122.4, 37.8])).toEqual({ longitude: -122.4, latitude: 37.8 })
    expect(parsePoint({ latitude: 1, longitude: 2 })).toEqual({ latitude: 1, longitude: 2 })
    expect(parsePoint({ coordinates: [3, 4] })).toEqual({ longitude: 3, latitude: 4 })
    expect(parsePoint(null)).toBeNull()
    expect(parsePoint([1])).toBeNull()
  })

  it('distanceMeters is zero for identical points', () => {
    const p = { latitude: 0, longitude: 0 }
    expect(distanceMeters(p, p)).toBe(0)
  })

  it('parseNearOperator handles array and GeoJSON forms', () => {
    expect(parseNearOperator([1, 2, 100])).toEqual({
      center: { longitude: 1, latitude: 2 },
      maxDistance: 100,
    })
    expect(parseNearOperator([1, 2, undefined, 5])).toEqual({
      center: { longitude: 1, latitude: 2 },
      minDistance: 5,
    })
    expect(
      parseNearOperator({
        $geometry: { coordinates: [10, 20] },
        $maxDistance: 50,
        $minDistance: 5,
      }),
    ).toEqual({
      center: { longitude: 10, latitude: 20 },
      maxDistance: 50,
      minDistance: 5,
    })
    expect(parseNearOperator('bad')).toBeNull()
    expect(parseNearOperator({ $geometry: { coordinates: [1] } })).toBeNull()
    expect(parseNearOperator(['a', 2] as never)).toBeNull()
    expect(parseNearOperator({ $geometry: { coordinates: [10, 20] } })).toEqual({
      center: { longitude: 10, latitude: 20 },
    })
  })

  it('parsePoint rejects invalid coordinate types', () => {
    expect(parsePoint(['a', 2] as never)).toBeNull()
    expect(parsePoint({ coordinates: ['a', 2] } as never)).toBeNull()
  })
})
