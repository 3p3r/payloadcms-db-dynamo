/**
 * Shared in-memory pagination for find / findVersions / queryDrafts / findDistinct.
 * Centralizes limit/page math so callers stay thin and branch coverage is one place.
 */
export type PaginateSliceOptions = {
  limit: number
  page: number
  /** When false, totalPages stays 1 and next/prev flags are false. Default true. */
  pagination?: boolean
  totalDocs: number
}

export type PaginateSliceMeta = {
  start: number
  end: number
  safePage: number
  effectiveLimit: number
  totalPages: number
  hasNextPage: boolean
  hasPrevPage: boolean
  nextPage: null | number
  prevPage: null | number
  pagingCounter: number
}

export function paginateSliceMeta(options: PaginateSliceOptions): PaginateSliceMeta {
  const { limit, page, totalDocs } = options
  const useLimit = limit > 0
  const withPagination = options.pagination !== false
  const safePage = useLimit ? Math.max(1, page) : 1
  const start = useLimit ? (safePage - 1) * limit : 0
  const end = useLimit ? start + limit : totalDocs
  const effectiveLimit = useLimit ? limit : totalDocs
  const totalPages = withPagination && useLimit ? Math.max(1, Math.ceil(totalDocs / limit)) : 1
  const hasNextPage = withPagination && useLimit && safePage < totalPages
  const hasPrevPage = withPagination && useLimit && safePage > 1

  return {
    start,
    end,
    safePage,
    effectiveLimit,
    totalPages,
    hasNextPage,
    hasPrevPage,
    nextPage: hasNextPage ? safePage + 1 : null,
    prevPage: hasPrevPage ? safePage - 1 : null,
    pagingCounter: useLimit ? (safePage - 1) * limit + 1 : 1,
  }
}

export function slicePage<T>(items: T[], meta: PaginateSliceMeta): T[] {
  return items.slice(meta.start, meta.end)
}
