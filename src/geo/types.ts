export type GeoJsonPosition = [number, number]

export function isGeoJsonPosition(coord: unknown): coord is GeoJsonPosition {
  return (
    Array.isArray(coord) &&
    coord.length >= 2 &&
    typeof coord[0] === 'number' &&
    typeof coord[1] === 'number'
  )
}

export type GeoShapeClause = {
  $geometry?: { coordinates?: unknown }
  coordinates?: unknown
}

export function isGeoShapeClause(value: unknown): value is GeoShapeClause {
  return typeof value === 'object' && value !== null
}
