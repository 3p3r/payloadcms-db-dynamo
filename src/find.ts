import type { Find, PaginatedDocs } from 'payload'

import type { DynamoAdapter } from './types.js'

import { applySorts } from './utilities/applySorts.js'
import { resolveJoins } from './utilities/resolveJoins.js'
import { collectionHasDrafts, fetchDraftsOnlySupplements } from './utilities/draftsFallback.js'
import { paginateSliceMeta, slicePage } from './utilities/paginateSlice.js'
import { queryMatching } from './utilities/queryMatching.js'

/**
 * v2 strategy: paginated `Query` over the collection's partition (`pk = slug`)
 * with `where` translated to `FilterExpression`, then in-memory sort and page
 * slice. `Query` reads only the rows in this collection's partition, so we no
 * longer pay to walk the whole table.
 *
 * For collections with `versions.drafts: true`, also pull `latest=true` rows
 * from the versions partition and union in any whose parent isn't already
 * represented in the main partition. This catches drafts-only docs (created
 * but never published) that would otherwise be invisible to `find`.
 *
 * Optimizations to land later:
 *  - Use `Query` against a GSI when the predicate matches an indexed key
 *    (e.g. `email` for auth, `slug` for public-facing collections).
 *  - Stream pages instead of materializing all matches when `pagination=false`
 *    and `limit` is small.
 */
export const find: Find = async function find(
  this: DynamoAdapter,
  { collection, joins, limit = 10, page = 1, pagination = true, req, sort, where },
) {
  const matched = await queryMatching(this, this.resolvePartition(collection), where, req)

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
