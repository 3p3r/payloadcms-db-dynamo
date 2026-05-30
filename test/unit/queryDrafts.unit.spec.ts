import { describe, expect, it, vi } from 'vitest'

import { queryDrafts } from '../../src/queryDrafts.js'
import type { DynamoAdapter } from '../../src/types.js'
import * as queryMatchingModule from '../../src/utilities/queryMatching.js'

describe('queryDrafts', () => {
  it('merges latest versions and main-partition orphans', async () => {
    vi.spyOn(queryMatchingModule, 'queryMatching')
      .mockResolvedValueOnce([
        { parent: '1', latest: true, version: null },
        { parent: '2', latest: true, version: { title: 'from-version' } },
      ])
      .mockResolvedValueOnce([
        { id: '2', title: 'stale-main' },
        { id: '3', title: 'main-only' },
      ])

    const adapter = {
      resolvePartition: (s: string) => s,
      resolveVersionsPartition: (s: string) => `${s}_versions`,
    } as DynamoAdapter

    const result = await queryDrafts.call(adapter, {
      collection: 'posts',
      limit: 0,
      where: undefined,
    })

    expect(result.totalDocs).toBe(2)
    const titles = result.docs.map((d) => d.title).sort()
    expect(titles).toEqual(['from-version', 'main-only'])

    vi.restoreAllMocks()
  })
})
