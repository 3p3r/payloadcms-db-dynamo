import type { FindGlobalVersions, PaginatedDocs } from 'payload'

import type { DynamoAdapter } from './types.js'

import { applySorts } from './utilities/applySorts.js'
import { paginateSliceMeta, slicePage } from './utilities/paginateSlice.js'
import { queryCount } from './utilities/queryCount.js'
import { queryMatching } from './utilities/queryMatching.js'

export const findGlobalVersions: FindGlobalVersions = async function findGlobalVersions(
  this: DynamoAdapter,
  args,
) {
  const { global: globalSlug, limit = 10, page = 1, pagination = true, sort, where } = args
  const partition = this.resolveVersionsPartition(globalSlug)
  const maxItems =
    sort || !pagination || limit <= 0 ? undefined : limit * Math.max(1, page)
  const matched = await queryMatching(
    this,
    partition,
    where,
    undefined,
    globalSlug,
    maxItems,
  )
  applySorts(matched, sort)

  const totalDocs = await queryCount(this, partition, where, globalSlug)
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
