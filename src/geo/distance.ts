export type PointCoordinates = {
  latitude: number
  longitude: number
}

export function parsePoint(value: unknown): PointCoordinates | null {
  if (!value) return null
  if (Array.isArray(value) && value.length >= 2) {
    const [lng, lat] = value
    if (typeof lng === 'number' && typeof lat === 'number') {
      return { longitude: lng, latitude: lat }
    }
  }
  if (typeof value === 'object' && value !== null) {
    const o = value as Record<string, unknown>
    if (typeof o.latitude === 'number' && typeof o.longitude === 'number') {
      return { latitude: o.latitude, longitude: o.longitude }
    }
    if (Array.isArray(o.coordinates) && o.coordinates.length >= 2) {
      const [lng, lat] = o.coordinates
      if (typeof lng === 'number' && typeof lat === 'number') {
        return { longitude: lng, latitude: lat }
      }
    }
  }
  return null
}

/** Meters between two WGS84 points (haversine). */
export function distanceMeters(a: PointCoordinates, b: PointCoordinates): number {
  const R = 6371000
  const toRad = (d: number) => (d * Math.PI) / 180
  const dLat = toRad(b.latitude - a.latitude)
  const dLon = toRad(b.longitude - a.longitude)
  const lat1 = toRad(a.latitude)
  const lat2 = toRad(b.latitude)
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)))
}

export function parseNearOperator(
  expected: unknown,
): { center: PointCoordinates; maxDistance?: number; minDistance?: number } | null {
  if (Array.isArray(expected)) {
    const [lng, lat, maxDistance, minDistance] = expected
    if (typeof lng !== 'number' || typeof lat !== 'number') return null
    return {
      center: { longitude: lng, latitude: lat },
      ...(typeof maxDistance === 'number' ? { maxDistance } : {}),
      ...(typeof minDistance === 'number' ? { minDistance } : {}),
    }
  }
  if (!expected || typeof expected !== 'object') return null
  const geo = expected as Record<string, unknown>
  const geometry = geo.$geometry as { coordinates?: number[] } | undefined
  const coords = geometry?.coordinates
  if (!coords || coords.length < 2) return null
  const center = { longitude: coords[0]!, latitude: coords[1]! }
  const maxDistance =
    typeof geo.$maxDistance === 'number' ? geo.$maxDistance : undefined
  const minDistance =
    typeof geo.$minDistance === 'number' ? geo.$minDistance : undefined
  return {
    center,
    ...(maxDistance !== undefined ? { maxDistance } : {}),
    ...(minDistance !== undefined ? { minDistance } : {}),
  }
}
