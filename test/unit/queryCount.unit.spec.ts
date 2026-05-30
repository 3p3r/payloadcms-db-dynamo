import { describe, expect, it, vi } from 'vitest'

import { queryCount } from '../../src/utilities/queryCount.js'
import { mockAdapter } from '../__helpers/mockAdapter.js'
import * as queryMatchingModule from '../../src/utilities/queryMatching.js'

describe('queryCount', () => {
  it('counts via queryMatching when where uses JS-only operators', async () => {
    vi.spyOn(queryMatchingModule, 'queryMatching').mockResolvedValue([{}, {}])
    const total = await queryCount(mockAdapter(), 'posts', { title: { like: 'a' } })
    expect(total).toBe(2)
    vi.restoreAllMocks()
  })

  it('paginates COUNT queries', async () => {
    const send = vi
      .fn()
      .mockResolvedValueOnce({ Count: 2, LastEvaluatedKey: { pk: 'p', sk: 'c' } })
      .mockResolvedValueOnce({ Count: 3 })
    const total = await queryCount(mockAdapter({ send }), 'p', { title: { equals: 'x' } })
    expect(total).toBe(5)
    expect(send).toHaveBeenCalledTimes(2)
    await expect(queryCount(mockAdapter({ docClient: undefined }), 'p', {})).rejects.toThrow(
      /docClient/,
    )
    expect(await queryCount(mockAdapter({ send }), 'p', { id: { in: [] } })).toBe(0)
  })
})
