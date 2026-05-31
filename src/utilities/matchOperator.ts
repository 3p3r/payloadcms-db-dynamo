import {
  distanceMeters,
  parseNearOperator,
  parsePoint,
  type PointCoordinates,
} from '../geo/distance.js'

import { compareValuesLoose } from './compareValues.js'

function matchLike(actual: unknown, expected: unknown, negate: boolean): boolean {
  if (typeof expected !== 'string' || expected === '') return true
  if (typeof actual !== 'string') return negate
  const hit = actual.toLowerCase().includes(expected.toLowerCase())
  return negate ? !hit : hit
}

function matchContains(actual: unknown, expected: unknown): boolean {
  if (Array.isArray(actual)) return actual.includes(expected)
  if (typeof actual === 'string' && typeof expected === 'string') {
    return actual.toLowerCase().includes(expected.toLowerCase())
  }
  return false
}

function matchGeoShape(actual: unknown, expected: unknown): boolean {
  const point = parsePoint(actual)
  if (!point || !expected || typeof expected !== 'object') return false
  const raw = expected as { $geometry?: { coordinates?: unknown }; coordinates?: unknown }
  const ring = extractPolygonRing(raw.$geometry?.coordinates ?? raw.coordinates)
  return ring ? pointInPolygon(point, ring) : false
}

export function extractPolygonRing(coordinates: unknown): PointCoordinates[] | null {
  if (!Array.isArray(coordinates)) return null
  const ring = (coordinates[0] ?? coordinates) as unknown[]
  if (!Array.isArray(ring)) return null
  const points: PointCoordinates[] = []
  for (const coord of ring) {
    if (!Array.isArray(coord) || coord.length < 2) continue
    const [lng, lat] = coord
    if (typeof lng === 'number' && typeof lat === 'number') {
      points.push({ longitude: lng, latitude: lat })
    }
  }
  return points.length >= 3 ? points : null
}

function pointInPolygon(point: PointCoordinates, ring: PointCoordinates[]): boolean {
  let inside = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i]!.longitude
    const yi = ring[i]!.latitude
    const xj = ring[j]!.longitude
    const yj = ring[j]!.latitude
    const intersect =
      yi > point.latitude !== yj > point.latitude &&
      point.longitude < ((xj - xi) * (point.latitude - yi)) / (yj - yi + 0) + xi
    if (intersect) inside = !inside
  }
  return inside
}

function matchNear(actual: unknown, expected: unknown): boolean {
  const near = parseNearOperator(expected)
  const point = parsePoint(actual)
  if (!near || !point) return false
  const d = distanceMeters(point, near.center)
  if (near.maxDistance !== undefined && d > near.maxDistance) return false
  if (near.minDistance !== undefined && d < near.minDistance) return false
  return true
}

export const MATCH_OPERATORS: Record<string, (actual: unknown, expected: unknown) => boolean> = {
  all: (actual, expected) =>
    Array.isArray(expected) && Array.isArray(actual) && expected.every((v) => actual.includes(v)),
  contains: matchContains,
  equals: (actual, expected) => actual === expected,
  exists: (actual, expected) =>
    Boolean(expected) ? actual !== undefined && actual !== null : actual === undefined || actual === null,
  greater_than: (actual, expected) => compareValuesLoose(actual, expected) > 0,
  greater_than_equal: (actual, expected) => compareValuesLoose(actual, expected) >= 0,
  in: (actual, expected) => Array.isArray(expected) && expected.includes(actual),
  intersects: matchGeoShape,
  less_than: (actual, expected) => compareValuesLoose(actual, expected) < 0,
  less_than_equal: (actual, expected) => compareValuesLoose(actual, expected) <= 0,
  like: (actual, expected) => matchLike(actual, expected, false),
  near: matchNear,
  not_equals: (actual, expected) => actual !== expected,
  not_in: (actual, expected) => Array.isArray(expected) && !expected.includes(actual),
  not_like: (actual, expected) => matchLike(actual, expected, true),
  within: matchGeoShape,
}

export function matchOperator(actual: unknown, operator: string, expected: unknown): boolean {
  return MATCH_OPERATORS[operator]?.(actual, expected) ?? false
}
