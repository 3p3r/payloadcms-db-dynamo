import type { Where } from 'payload'

import { extractGeoClause } from '../geo/queryGeo.js'
import { collectDeclaredIndexPaths } from '../schema/collectFields.js'
import type { DynamoAdapter } from '../types.js'

export type QueryPlan =
  | {
      kind: 'partition'
      partition: string
      where?: Where
    }
  | {
      kind: 'inverted'
      partition: string
      field: string
      value: unknown
      remainder?: Where
    }
  | {
      kind: 'geo'
      collection: string
      field: string
      operator: 'near' | 'within' | 'intersects'
      clause: unknown
      remainder?: Where
    }
  | {
      kind: 'gsi1-list'
      collection: string
      partition: string
    }

function extractIndexedEquals(
  where: Where | undefined,
  indexPaths: string[],
): { field: string; value: unknown; remainder?: Where } | null {
  if (!where || indexPaths.length === 0) return null
  for (const field of indexPaths) {
    const clause = where[field]
    if (!clause || typeof clause !== 'object') continue
    if ('equals' in clause && clause.equals !== undefined) {
      const remainder = { ...where }
      delete remainder[field]
      const rem = Object.keys(remainder).length ? (remainder as Where) : undefined
      return { field, value: clause.equals, ...(rem ? { remainder: rem } : {}) }
    }
  }
  return null
}

export function compileQuery(
  adapter: DynamoAdapter,
  collection: string,
  where: Where | undefined,
): QueryPlan {
  const partition =
    typeof adapter.resolvePartition === 'function'
      ? adapter.resolvePartition(collection)
      : collection
  const config = adapter.payload?.collections?.[collection]?.config
  const indexPaths = config ? collectDeclaredIndexPaths(config) : []

  const geo = extractGeoClause(where)
  if (geo) {
    return {
      kind: 'geo',
      collection,
      field: geo.field,
      operator: geo.operator,
      clause: geo.clause,
      ...(geo.remainder ? { remainder: geo.remainder } : {}),
    }
  }

  const indexed = extractIndexedEquals(where, indexPaths)
  if (indexed) {
    return {
      kind: 'inverted',
      partition,
      field: indexed.field,
      value: indexed.value,
      ...(indexed.remainder ? { remainder: indexed.remainder } : {}),
    }
  }

  if ((!where || Object.keys(where).length === 0) && adapter.payload?.collections?.[collection]) {
    return { kind: 'gsi1-list', collection, partition }
  }

  return { kind: 'partition', partition, where }
}
