import { describe, expect, it } from 'vitest'

import {
  coveringForRadius,
  coveringForRectangle,
  geohashForPoint,
  toGeoPoint,
} from '../../src/geo/geohash.js'

describe('geo/geohash', () => {
  it('generates geohash and covering for radius', () => {
    const point = toGeoPoint(-122.4194, 37.7749)
    const { geohash, hashPrefix } = geohashForPoint(point)
    expect(geohash.length).toBeGreaterThan(5)
    expect(hashPrefix.length).toBeGreaterThan(0)
    const ranges = coveringForRadius(point, 500_000)
    expect(ranges.length).toBeGreaterThan(0)
    const box = coveringForRectangle(
      toGeoPoint(-123, 37),
      toGeoPoint(-121, 38),
    )
    expect(box.length).toBeGreaterThan(0)
  })
})
