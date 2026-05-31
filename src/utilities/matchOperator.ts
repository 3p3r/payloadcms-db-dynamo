import {
  distanceMeters,
  parseNearOperator,
  parsePoint,
  type PointCoordinates,
} from '../geo/distance.js'
import { isGeoJsonPosition, isGeoShapeClause } from '../geo/types.js'

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
  if (!point || !isGeoShapeClause(expected)) return false
  const ring = extractPolygonRing(expected.$geometry?.coordinates ?? expected.coordinates)
  return ring ? pointInPolygon(point, ring) : false
}

export function extractPolygonRing(coordinates: unknown): PointCoordinates[] | null {
  if (!Array.isArray(coordinates)) return null
  const first = coordinates[0]
  const ringCandidate =
    Array.isArray(first) && isGeoJsonPosition(first)
      ? coordinates
      : Array.isArray(first)
        ? first
        : null
  if (!Array.isArray(ringCandidate)) return null
  const points: PointCoordinates[] = []
  for (const coord of ringCandidate) {
    if (!isGeoJsonPosition(coord)) continue
    points.push({ longitude: coord[0], latitude: coord[1] })
  }
  return points.length >= 3 ? points : null
}

function pointInPolygon(point: PointCoordinates, ring: PointCoordinates[]): boolean {
  let inside = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const vertexI = ring[i]
    const vertexJ = ring[j]
    if (!vertexI || !vertexJ) continue
    const xi = vertexI.longitude
    const yi = vertexI.latitude
    const xj = vertexJ.longitude
    const yj = vertexJ.latitude
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
