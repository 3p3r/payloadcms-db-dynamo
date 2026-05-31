import type { FindDistinct, PaginatedDistinctDocs } from 'payload'

import type { DynamoAdapter } from './types.js'

import { applySorts } from './utilities/applySorts.js'
import { getPath } from './utilities/getPath.js'
import { paginateSliceMeta, slicePage } from './utilities/paginateSlice.js'
import { queryMatching } from './utilities/queryMatching.js'

/**
 * Loads matches through `queryMatching`, dedupes field values in memory, then
 * sorts and paginates. Dedup uses primitive `Set` equality (not deep).
 */
export const findDistinct: FindDistinct = async function findDistinct(
  this: DynamoAdapter,
  { collection, field, limit = 10, page = 1, sort, where },
) {
  const partition = this.resolvePartition(collection)
  const matched = await queryMatching(
    this,
    partition,
    where,
    undefined,
    collection,
  )

  const seen = new Set<unknown>()
  const values: Record<string, unknown>[] = []
  for (const item of matched) {
    const value = getPath(item, field)
    if (value === undefined) continue
    if (seen.has(value)) continue
    seen.add(value)
    values.push({ [field]: value })
  }

  applySorts(values, sort)

  const totalDocs = values.length
  const meta = paginateSliceMeta({ limit, page, pagination: true, totalDocs })
  const paged = slicePage(values, meta)

  const result: PaginatedDistinctDocs<Record<string, unknown>> = {
    values: paged,
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
  return result
}
