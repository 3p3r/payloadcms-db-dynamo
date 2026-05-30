import { describe, expect, it } from 'vitest'

import { paginateSliceMeta, slicePage } from '../../src/utilities/paginateSlice.js'

describe('paginateSliceMeta', () => {
  const items = [1, 2, 3, 4, 5]

  it('paginates with limit and pages', () => {
    const meta = paginateSliceMeta({ limit: 2, page: 2, totalDocs: 5 })
    expect(slicePage(items, meta)).toEqual([3, 4])
    expect(meta.hasNextPage).toBe(true)
    expect(meta.hasPrevPage).toBe(true)
    expect(meta.nextPage).toBe(3)
    expect(meta.prevPage).toBe(1)
  })

  it('limit 0 returns all rows', () => {
    const meta = paginateSliceMeta({ limit: 0, page: 99, totalDocs: 5 })
    expect(slicePage(items, meta)).toEqual(items)
    expect(meta.hasNextPage).toBe(false)
    expect(meta.totalPages).toBe(1)
  })

  it('pagination false keeps metadata flat', () => {
    const meta = paginateSliceMeta({ limit: 2, page: 2, pagination: false, totalDocs: 5 })
    expect(meta.totalPages).toBe(1)
    expect(meta.hasNextPage).toBe(false)
    expect(meta.hasPrevPage).toBe(false)
  })

  it('single page has no next', () => {
    const meta = paginateSliceMeta({ limit: 10, page: 1, totalDocs: 3 })
    expect(meta.hasNextPage).toBe(false)
    expect(meta.hasPrevPage).toBe(false)
  })
})
