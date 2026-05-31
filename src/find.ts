import type { Find, PaginatedDocs } from 'payload'

import type { DynamoAdapter } from './types.js'

import { applySorts } from './utilities/applySorts.js'
import { resolveJoins } from './utilities/resolveJoins.js'
import { collectionHasDrafts, fetchDraftsOnlySupplements } from './utilities/draftsFallback.js'
import { paginateSliceMeta, slicePage } from './utilities/paginateSlice.js'
import { queryCount } from './utilities/queryCount.js'
import { queryMatching } from './utilities/queryMatching.js'

/**
 * Resolves matches via `queryMatching` (inverted / gsi1-list / geo-index / partition),
 * then sorts and paginates. Draft-enabled collections also merge draft-only parents
 * from the versions gsi1 latest spine (`draftsFallback`).
 */
export const find: Find = async function find(
  this: DynamoAdapter,
  { collection, joins, limit = 10, page = 1, pagination = true, req, sort, where },
) {
  const partition = this.resolvePartition(collection)
  const maxItems =
    sort || !pagination || limit <= 0 ? undefined : limit * Math.max(1, page)
  const matched = await queryMatching(
    this,
    partition,
    where,
    req,
    collection,
    maxItems,
  )

  if (collectionHasDrafts(this, collection)) {
    const supplements = await fetchDraftsOnlySupplements(this, collection, matched, where, req)
    matched.push(...supplements)
  }

  applySorts(matched, sort)

  const totalDocs = await queryCount(this, partition, where, collection)
  const meta = paginateSliceMeta({ limit, page, pagination, totalDocs })
  const docs = slicePage(matched, meta)

  await resolveJoins(this, {
    collectionSlug: collection,
    docs,
    ...(joins ? { joins } : {}),
    limit,
    ...(req ? { req } : {}),
  })

  const result: PaginatedDocs<Record<string, unknown>> = {
    docs,
    hasNextPage: meta.hasNextPage,
    hasPrevPage: meta.hasPrevPage,
    limit: meta.effectiveLimit,
    nextPage: meta.nextPage,
    page: meta.safePage,
    pagingCounter: meta.pagingCounter,
    prevPage: meta.prevPage,
    totalDocs,
    totalPages: meta.totalPages,
  }
  return result as never
}
