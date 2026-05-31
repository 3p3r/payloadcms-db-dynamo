import { Covering } from 'dynamodb-geo-v3/dist/model/Covering.js'
import { GeohashRange } from 'dynamodb-geo-v3/dist/model/GeohashRange.js'
import { S2Manager } from 'dynamodb-geo-v3/dist/s2/S2Manager.js'
import { S2Util } from 'dynamodb-geo-v3/dist/s2/S2Util.js'
import { S2RegionCoverer } from 'nodes2ts'
import type { GeoPoint } from 'dynamodb-geo-v3/dist/types.js'

import { geoPk } from '../schema/keys.js'

export function toGeoPoint(longitude: number, latitude: number): GeoPoint {
  return { longitude, latitude }
}

export function geohashForPoint(
  point: GeoPoint,
  geoHashKeyLength: number,
): { geohash: string; hashPrefix: string } {
  const geohash = S2Manager.generateGeohash(point)
  const hashPrefix = S2Manager.generateHashKey(geohash, geoHashKeyLength).toString(10)
  return { geohash: geohash.toString(10), hashPrefix }
}

export function coveringForRadius(
  center: GeoPoint,
  radiusMeters: number,
  geoHashKeyLength: number,
): GeohashRange[] {
  const rect = S2Util.getBoundingLatLngRectFromQueryRadiusInput({
    CenterPoint: center,
    RadiusInMeter: radiusMeters,
  })
  const coverer = new S2RegionCoverer()
  const covering = new Covering(coverer.getCoveringCells(rect))
  return covering.getGeoHashRanges(geoHashKeyLength)
}

export function coveringForRectangle(
  min: GeoPoint,
  max: GeoPoint,
  geoHashKeyLength: number,
): GeohashRange[] {
  const rect = S2Util.latLngRectFromQueryRectangleInput({
    MinPoint: min,
    MaxPoint: max,
  })
  const coverer = new S2RegionCoverer()
  const covering = new Covering(coverer.getCoveringCells(rect))
  return covering.getGeoHashRanges(geoHashKeyLength)
}

export function geoPartitionForCell(
  slug: string,
  fieldPath: string,
  hashPrefix: string | number,
): string {
  return geoPk(slug, fieldPath, hashPrefix)
}
