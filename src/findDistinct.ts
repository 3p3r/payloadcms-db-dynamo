import type { FindDistinct, PaginatedDistinctDocs } from 'payload'

import type { DynamoAdapter } from './types.js'

import { applySorts } from './utilities/applySorts.js'
import { getByPath } from './utilities/getByPath.js'
import { paginateSliceMeta, slicePage } from './utilities/paginateSlice.js'
import { queryMatching } from './utilities/queryMatching.js'

/**
 * v2 strategy: paginated `Query` over the collection's partition, JS `where`
 * filter has already been pushed down via `FilterExpression`, then dedup via
 * `Set` and sort + paginate the resulting value list.
 *
 * Dedup uses primitive equality. Object- or array-valued fields would compare
 * by reference, so if you `findDistinct` over a non-primitive field you'll
 * get one entry per item (no real dedup). Stringification-based dedup can
 * land if it turns out to matter.
 */
export const findDistinct: FindDistinct = async function findDistinct(
  this: DynamoAdapter,
  { collection, field, limit = 10, page = 1, sort, where },
) {
  const matched = await queryMatching(
    this,
    this.resolvePartition(collection),
    where,
    undefined,
    collection,
  )

  const seen = new Set<unknown>()
  const values: Record<string, unknown>[] = []
  for (const item of matched) {
    const value = getByPath(item, field)
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
