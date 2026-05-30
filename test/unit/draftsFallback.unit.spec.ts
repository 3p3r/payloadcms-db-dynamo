import { describe, expect, it, vi } from 'vitest'

import {
  collectionHasDrafts,
  fetchDraftsOnlySupplements,
} from '../../src/utilities/draftsFallback.js'
import * as queryMatchingModule from '../../src/utilities/queryMatching.js'

describe('draftsFallback', () => {
  it('collectionHasDrafts reads config', () => {
    const adapter = {
      payload: {
        config: {
          collections: [
            { slug: 'with', versions: { drafts: true } },
            { slug: 'without', versions: false },
          ],
        },
      },
    } as never
    expect(collectionHasDrafts(adapter, 'with')).toBe(true)
    expect(collectionHasDrafts(adapter, 'without')).toBe(false)
  })

  it('fetchDraftsOnlySupplements projects version rows', async () => {
    vi.spyOn(queryMatchingModule, 'queryMatching').mockResolvedValue([
      {
        parent: 'p1',
        version: { title: 'draft-title', priority: 2 },
      },
      { parent: 'p1', version: null },
      { parent: 'p2', version: { title: 'other' } },
    ])

    const adapter = {
      resolveVersionsPartition: (s: string) => `${s}_versions`,
    } as never

    const supplements = await fetchDraftsOnlySupplements(
      adapter,
      'drafts-on',
      [],
      { title: { equals: 'draft-title' } },
    )
    expect(supplements).toHaveLength(1)
    expect(supplements[0]?.title).toBe('draft-title')
    expect(supplements[0]?.id).toBe('p1')

    vi.restoreAllMocks()
  })
})
