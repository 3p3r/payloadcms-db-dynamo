import { describe, expect, it, vi } from 'vitest'

import { queryMatching } from '../../src/utilities/queryMatching.js'
import { mockAdapter } from '../__helpers/mockAdapter.js'

describe('queryMatching', () => {
  it('paginates until all partition rows are loaded', async () => {
    const send = vi
      .fn()
      .mockResolvedValueOnce({
        Items: [{ pk: 'p', sk: '1' }],
        LastEvaluatedKey: { pk: 'p', sk: '1' },
      })
      .mockResolvedValueOnce({ Items: [{ pk: 'p', sk: '2' }] })

    const adapter = mockAdapter({
      send,
      tableName: 't',
      payload: { collections: {} },
    })
    const rows = await queryMatching(adapter, 'p', { title: { equals: 'x' } }, undefined, 'p')
    expect(rows).toHaveLength(2)
  })

  it('treats missing Items as an empty page while paginating', async () => {
    const send = vi
      .fn()
      .mockResolvedValueOnce({ LastEvaluatedKey: { pk: 'p', sk: '1' } })
      .mockResolvedValueOnce({ Items: [{ pk: 'p', sk: '2', title: 'b' }] })
    const adapter = mockAdapter({
      send,
      tableName: 't',
      payload: { collections: { p: { config: { fields: [] } } } },
    })
    const rows = await queryMatching(adapter, 'p', undefined, undefined, 'p')
    expect(rows).toHaveLength(1)
  })

  it('returns empty for NEVER filters', async () => {
    const send = vi.fn()
    const adapter = mockAdapter({
      send,
      tableName: 't',
      payload: { collections: {} },
    })
    const rows = await queryMatching(adapter, 'p', { id: { in: [] } }, undefined, 'p')
    expect(rows).toEqual([])
    expect(send).not.toHaveBeenCalled()
  })
})
