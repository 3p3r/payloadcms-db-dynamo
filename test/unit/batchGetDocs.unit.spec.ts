import { describe, expect, it, vi } from 'vitest'

import { batchGetCollectionDocs } from '../../src/utilities/batchGetDocs.js'
import { mockAdapter } from '../__helpers/mockAdapter.js'

describe('batchGetCollectionDocs', () => {
  it('batch-gets docs by id', async () => {
    const send = vi.fn().mockResolvedValue({
      Responses: { t: [{ pk: 'items', sk: '1', id: '1', title: 'a' }] },
    })
    const adapter = mockAdapter({ send, tableName: 't' })
    const docs = await batchGetCollectionDocs(adapter, 'items', ['1'])
    expect(docs).toHaveLength(1)
    expect(docs[0]?.title).toBe('a')
  })

  it('returns empty for no ids', async () => {
    const adapter = mockAdapter()
    expect(await batchGetCollectionDocs(adapter, 'items', [])).toEqual([])
  })

  it('handles missing Responses', async () => {
    const send = vi.fn().mockResolvedValue({})
    const adapter = mockAdapter({ send, tableName: 't' })
    expect(await batchGetCollectionDocs(adapter, 'items', ['1'])).toEqual([])
  })
})
