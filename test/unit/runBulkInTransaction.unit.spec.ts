import { TransactWriteCommand } from '@aws-sdk/lib-dynamodb'
import { describe, expect, it, vi } from 'vitest'

import { deleteMany } from '../../src/deleteMany.js'
import { updateMany } from '../../src/updateMany.js'
import * as queryMatchingModule from '../../src/utilities/queryMatching.js'
import { mockAdapter } from '../__helpers/mockAdapter.js'

describe('runBulkInTransaction', () => {
  it('wraps deleteMany in begin/commit when bulkOperationsSingleTransaction is true', async () => {
    const send = vi.fn().mockResolvedValue({})
    const adapter = mockAdapter({
      send,
      bulkOperationsSingleTransaction: true,
      transactionSessions: {},
    })

    vi.spyOn(queryMatchingModule, 'queryMatching').mockResolvedValue([
      { id: '1', title: 'x' },
    ])

    await deleteMany.call(adapter, { collection: 'items', where: {} })

    expect(send.mock.calls.some(([cmd]) => cmd instanceof TransactWriteCommand)).toBe(true)
    vi.restoreAllMocks()
  })

  it('does not open a transaction when req already has transactionID', async () => {
    const send = vi.fn().mockResolvedValue({})
    const adapter = mockAdapter({
      send,
      bulkOperationsSingleTransaction: true,
      transactionSessions: {
        existing: {
          id: 'existing',
          deleted: new Set(),
          overlay: new Map(),
          transactItems: [],
        },
      },
    })

    vi.spyOn(queryMatchingModule, 'queryMatching').mockResolvedValue([])

    await deleteMany.call(adapter, {
      collection: 'items',
      where: {},
      req: { transactionID: 'existing' } as never,
    })

    expect(send.mock.calls.some(([cmd]) => cmd instanceof TransactWriteCommand)).toBe(false)
    vi.restoreAllMocks()
  })

  it('rolls back updateMany on write failure', async () => {
    const send = vi
      .fn()
      .mockRejectedValueOnce(new Error('conditional failed'))
      .mockResolvedValue({})
    const adapter = mockAdapter({
      send,
      bulkOperationsSingleTransaction: true,
      transactionSessions: {},
      payload: {
        collections: {
          posts: { config: { fields: [{ name: 'title', type: 'text' }] } },
        },
        config: { globals: [] },
        logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn() },
      } as never,
    })

    vi.spyOn(queryMatchingModule, 'queryMatching').mockResolvedValue([
      { id: '1', title: 'a', updatedAt: 't1' },
    ])

    await expect(
      updateMany.call(adapter, {
        collection: 'posts',
        where: {},
        data: { title: 'fail' },
      }),
    ).rejects.toThrow(/conditional failed/)

    expect(Object.keys(adapter.transactionSessions ?? {})).toHaveLength(0)
    vi.restoreAllMocks()
  })
})
