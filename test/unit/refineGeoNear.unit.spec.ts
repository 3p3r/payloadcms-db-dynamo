import { describe, expect, it } from 'vitest'

import { refineGeoNear } from '../../src/geo/queryGeo.js'

describe('refineGeoNear', () => {
  it('filters by max distance', () => {
    const doc = { location: [-122.4194, 37.7749] }
    expect(refineGeoNear(doc, 'location', [-122.4194, 37.7749, 100])).toBe(true)
    expect(refineGeoNear(doc, 'location', [-122.5, 37.7749, 1000])).toBe(false)
  })

  it('returns false for invalid point or clause', () => {
    expect(refineGeoNear({}, 'location', null)).toBe(false)
  })
})
