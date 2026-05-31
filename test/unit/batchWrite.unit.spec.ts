import { BatchWriteCommand } from '@aws-sdk/lib-dynamodb'
import { describe, expect, it, vi } from 'vitest'

import { batchDeleteKeys } from '../../src/utilities/batchWrite.js'
import { mockAdapter } from '../__helpers/mockAdapter.js'

describe('batchDeleteKeys', () => {
  it('retries unprocessed items', async () => {
    const key = { pk: 'p', sk: '1' }
    const send = vi
      .fn()
      .mockResolvedValueOnce({
        UnprocessedItems: {
          t: [{ DeleteRequest: { Key: key } }],
        },
      })
      .mockResolvedValueOnce({})
    const adapter = mockAdapter({ send, tableName: 't' })

    await batchDeleteKeys(adapter, [key])
    expect(send).toHaveBeenCalledTimes(2)
    expect(send.mock.calls.every(([cmd]) => cmd instanceof BatchWriteCommand)).toBe(true)
  })

  it('throws after max unprocessed retries', async () => {
    const key = { pk: 'p', sk: '1' }
    const send = vi.fn().mockResolvedValue({
      UnprocessedItems: { t: [{ DeleteRequest: { Key: key } }] },
    })
    const adapter = mockAdapter({ send, tableName: 't' })

    await expect(batchDeleteKeys(adapter, [key])).rejects.toThrow(/unprocessed/i)
  })

  it('rethrows non-unprocessed errors from send', async () => {
    const key = { pk: 'p', sk: '1' }
    const send = vi.fn().mockRejectedValue(new Error('network down'))
    const adapter = mockAdapter({ send, tableName: 't' })
    await expect(batchDeleteKeys(adapter, [key])).rejects.toThrow('network down')
  })

  it('throws when docClient is missing', async () => {
    const adapter = mockAdapter({ docClient: undefined })
    await expect(batchDeleteKeys(adapter, [{ pk: 'p', sk: '1' }])).rejects.toThrow(/initialized/)
  })
})
