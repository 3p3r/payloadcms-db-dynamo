import { describe, expect, it, vi } from 'vitest'

import type { DynamoAdapter } from '../../src/types.js'
import { queryMatching } from '../../src/utilities/queryMatching.js'

describe('queryMatching', () => {
  it('paginates until all partition rows are loaded', async () => {
    const send = vi
      .fn()
      .mockResolvedValueOnce({
        Items: [{ pk: 'p', sk: '1' }],
        LastEvaluatedKey: { pk: 'p', sk: '1' },
      })
      .mockResolvedValueOnce({ Items: [{ pk: 'p', sk: '2' }] })

    const adapter = { tableName: 't', docClient: { send } } as unknown as DynamoAdapter
    const rows = await queryMatching(adapter, 'p', { title: { equals: 'x' } })
    expect(rows).toHaveLength(2)
  })

  it('treats missing Items as an empty page while paginating', async () => {
    const send = vi
      .fn()
      .mockResolvedValueOnce({ LastEvaluatedKey: { pk: 'p', sk: '1' } })
      .mockResolvedValueOnce({ Items: [{ pk: 'p', sk: '2', title: 'b' }] })
    const adapter = { tableName: 't', docClient: { send } } as unknown as DynamoAdapter
    const rows = await queryMatching(adapter, 'p')
    expect(rows).toHaveLength(1)
  })

  it('returns empty for NEVER filters', async () => {
    const send = vi.fn()
    const adapter = { tableName: 't', docClient: { send } } as unknown as DynamoAdapter
    const rows = await queryMatching(adapter, 'p', { id: { in: [] } })
    expect(rows).toEqual([])
    expect(send).not.toHaveBeenCalled()
  })
})
