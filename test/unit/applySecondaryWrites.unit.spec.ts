import { describe, expect, it, vi } from 'vitest'

import {
  applySecondaryWrites,
  deleteCollectionIndexes,
} from '../../src/index/applySecondaryWrites.js'
import { mockAdapter } from '../__helpers/mockAdapter.js'

describe('applySecondaryWrites', () => {
  const payload = {
    collections: {
      places: {
        config: {
          fields: [{ name: 'location', type: 'point' }],
          sanitizedIndexes: [],
        },
      },
    },
    config: { globals: [] },
  } as never

  it('applies puts and deletes', async () => {
    const send = vi.fn().mockResolvedValue({})
    const adapter = mockAdapter({ send, payload })
    await applySecondaryWrites(adapter, undefined, {
      puts: [{ pk: 'GEO#places#location#1', sk: 'DOC#1', geohash: '123' }],
      deletes: [{ pk: 'GEO#old', sk: 'DOC#1' }],
    })
    expect(send).toHaveBeenCalledTimes(2)
  })

  it('deleteCollectionIndexes removes geo rows for a doc', async () => {
    const send = vi.fn().mockResolvedValue({})
    const adapter = mockAdapter({ send, payload })
    await deleteCollectionIndexes(
      adapter,
      'places',
      { id: '1', location: [-122, 37], createdAt: 't', updatedAt: 't' },
    )
    expect(send.mock.calls.length).toBeGreaterThan(0)
  })
})
