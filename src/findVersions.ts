import type { FindVersions, PaginatedDocs } from 'payload'

import type { DynamoAdapter } from './types.js'

import { applySorts } from './utilities/applySorts.js'
import { paginateSliceMeta, slicePage } from './utilities/paginateSlice.js'
import { queryMatching } from './utilities/queryMatching.js'

/**
 * Same shape as `find` but routed at the versions partition. Could share
 * more code with `find` via a `paginatedQuery(adapter, partition, args)`
 * helper, but keeping them separate makes per-method tweaks (e.g.
 * version-only filters, eventual draft-aware logic) easier to land without
 * refactoring.
 */
export const findVersions: FindVersions = async function findVersions(
  this: DynamoAdapter,
  { collection, limit = 10, page = 1, pagination = true, sort, where },
) {
  const partition = this.resolveVersionsPartition(collection)
  const matched = await queryMatching(this, partition, where)
  applySorts(matched, sort)

  const totalDocs = matched.length
  const meta = paginateSliceMeta({ limit, page, pagination, totalDocs })
  const docs = slicePage(matched, meta)

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
