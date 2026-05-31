import { describe, expect, it } from 'vitest'

import { resolveAdapterConfig } from '../../src/config.js'
import {
  coveringForRadius,
  coveringForRectangle,
  geohashForPoint,
  toGeoPoint,
} from '../../src/geo/geohash.js'

describe('geo/geohash', () => {
  it('generates geohash and covering for radius', () => {
    const geoHashKeyLength = resolveAdapterConfig().geoHashKeyLength
    const point = toGeoPoint(-122.4194, 37.7749)
    const { geohash, hashPrefix } = geohashForPoint(point, geoHashKeyLength)
    expect(geohash.length).toBeGreaterThan(5)
    expect(hashPrefix.length).toBeGreaterThan(0)
    const ranges = coveringForRadius(point, 500_000, geoHashKeyLength)
    expect(ranges.length).toBeGreaterThan(0)
    const box = coveringForRectangle(
      toGeoPoint(-123, 37),
      toGeoPoint(-121, 38),
      geoHashKeyLength,
    )
    expect(box.length).toBeGreaterThan(0)
  })
})
