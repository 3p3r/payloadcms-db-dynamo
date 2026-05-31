import type { Where } from 'payload'

import { extractGeoClause } from '../geo/queryGeo.js'
import { collectDeclaredIndexPaths } from '../schema/collectFields.js'
import { collectSearchIndexPaths } from '../schema/searchIndex.js'
import type { DynamoAdapter } from '../types.js'
import { buildFilterExpression } from './buildFilterExpression.js'
import { extractSearchLikeWhere } from './extractSearchWhere.js'
import { whereHasJsOnlyOperator } from './operators.js'

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
      kind: 'inverted-in'
      collection: string
      field: string
      values: unknown[]
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
      where?: Where
    }
  | {
      kind: 'version-latest-gsi1'
      collection: string
      where?: Where
    }
  | {
      kind: 'version-parent-gsi1'
      collection: string
      parentId: string
      where?: Where
    }
  | {
      kind: 'search-ngram'
      collection: string
      searchText: string
      operator: 'contains' | 'like' | 'not_like'
      fields: string[]
      remainder?: Where
    }

export function extractIndexedEquals(
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

export function extractIndexedIn(
  where: Where | undefined,
  indexPaths: string[],
): { field: string; values: unknown[]; remainder?: Where } | null {
  if (!where || indexPaths.length === 0) return null
  for (const field of indexPaths) {
    const clause = where[field]
    if (!clause || typeof clause !== 'object') continue
    if ('in' in clause && Array.isArray(clause.in) && clause.in.length > 0) {
      const remainder = { ...where }
      delete remainder[field]
      const rem = Object.keys(remainder).length ? (remainder as Where) : undefined
      return { field, values: clause.in, ...(rem ? { remainder: rem } : {}) }
    }
  }
  return null
}

export function canUseGsi1ListPlan(
  adapter: DynamoAdapter,
  collection: string,
  where: Where | undefined,
  indexPaths: string[],
): boolean {
  if (!adapter.payload?.collections?.[collection]) return false
  if (extractGeoClause(where)) return false
  if (extractIndexedEquals(where, indexPaths)) return false
  if (extractIndexedIn(where, indexPaths)) return false
  if (whereHasJsOnlyOperator(where)) return false
  if (buildFilterExpression(where) === null) return false
  return true
}

function collectionSlugFromVersionsPartition(partition: string): string | null {
  if (!partition.endsWith('_versions')) return null
  return partition.slice(0, -'_versions'.length)
}

function canPushFilter(where: Where | undefined): boolean {
  if (extractGeoClause(where)) return false
  if (whereHasJsOnlyOperator(where)) return false
  if (buildFilterExpression(where) === null) return false
  return true
}

function extractVersionLatestWhere(
  where: Where | undefined,
): { remainder?: Where } | null {
  if (!where) return null
  const latestClause = where['latest']
  if (
    latestClause &&
    typeof latestClause === 'object' &&
    !Array.isArray(latestClause) &&
    'equals' in latestClause &&
    (latestClause as Record<string, unknown>)['equals'] === true
  ) {
    const remainder = { ...where }
    delete remainder['latest']
    const rem = Object.keys(remainder).length ? (remainder as Where) : undefined
    return rem ? { remainder: rem } : {}
  }
  return null
}

function extractVersionParentWhere(
  where: Where | undefined,
): { parentId: string; remainder?: Where } | null {
  const parentRaw = where?.['parent']
  if (!parentRaw || typeof parentRaw !== 'object' || Array.isArray(parentRaw)) return null
  const parentClause = parentRaw as Record<string, unknown>
  if (!('equals' in parentClause) || parentClause['equals'] === undefined) return null
  const remainder = { ...where }
  delete remainder['parent']
  const rem = Object.keys(remainder).length ? (remainder as Where) : undefined
  return {
    parentId: String(parentClause['equals']),
    ...(rem ? { remainder: rem } : {}),
  }
}

export function compileQuery(
  adapter: DynamoAdapter,
  collection: string,
  where: Where | undefined,
  options?: { partition?: string },
): QueryPlan {
  const partition = options?.partition ?? adapter.resolvePartition(collection)

  const versionSlug = collectionSlugFromVersionsPartition(partition)
  if (versionSlug) {
    const latest = extractVersionLatestWhere(where)
    if (latest !== null && canPushFilter(latest.remainder)) {
      return {
        kind: 'version-latest-gsi1',
        collection: versionSlug,
        ...(latest.remainder ? { where: latest.remainder } : {}),
      }
    }
    const parent = extractVersionParentWhere(where)
    if (parent && canPushFilter(parent.remainder)) {
      return {
        kind: 'version-parent-gsi1',
        collection: versionSlug,
        parentId: parent.parentId,
        ...(parent.remainder ? { where: parent.remainder } : {}),
      }
    }
    return {
      kind: 'partition',
      partition,
      ...(where !== undefined ? { where } : {}),
    }
  }

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

  const indexedIn = extractIndexedIn(where, indexPaths)
  if (indexedIn) {
    return {
      kind: 'inverted-in',
      collection,
      field: indexedIn.field,
      values: indexedIn.values,
      ...(indexedIn.remainder ? { remainder: indexedIn.remainder } : {}),
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

  const searchPaths = config ? collectSearchIndexPaths(config) : []
  const searchLike = extractSearchLikeWhere(where, searchPaths)
  if (searchLike && canPushFilter(searchLike.remainder)) {
    return {
      kind: 'search-ngram',
      collection,
      searchText: searchLike.searchText,
      operator: searchLike.operator,
      fields: searchLike.fields,
      ...(searchLike.remainder ? { remainder: searchLike.remainder } : {}),
    }
  }

  if (canUseGsi1ListPlan(adapter, collection, where, indexPaths)) {
    return {
      kind: 'gsi1-list',
      collection,
      partition,
      ...(where !== undefined ? { where } : {}),
    }
  }

  return {
    kind: 'partition',
    partition,
    ...(where !== undefined ? { where } : {}),
  }
}
