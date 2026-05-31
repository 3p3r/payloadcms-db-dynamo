import type { Find, PaginatedDocs } from 'payload'

import type { DynamoAdapter } from './types.js'

import { applySorts } from './utilities/applySorts.js'
import { resolveJoins } from './utilities/resolveJoins.js'
import { collectionHasDrafts, fetchDraftsOnlySupplements } from './utilities/draftsFallback.js'
import { paginateSliceMeta, slicePage } from './utilities/paginateSlice.js'
import { queryMatching } from './utilities/queryMatching.js'

/**
 * Resolves matches via `queryMatching` (inverted / gsi1-list / geo-index / partition),
 * then sorts and paginates in memory. Draft-enabled collections also merge
 * draft-only parents from the versions partition (`draftsFallback`).
 *
 * See HANDOFF.md for paths that still read a full partition before paging.
 */
export const find: Find = async function find(
  this: DynamoAdapter,
  { collection, joins, limit = 10, page = 1, pagination = true, req, sort, where },
) {
  const matched = await queryMatching(
    this,
    this.resolvePartition(collection),
    where,
    req,
    collection,
  )

  if (collectionHasDrafts(this, collection)) {
    const supplements = await fetchDraftsOnlySupplements(this, collection, matched, where, req)
    matched.push(...supplements)
  }

  applySorts(matched, sort)

  const totalDocs = matched.length
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
