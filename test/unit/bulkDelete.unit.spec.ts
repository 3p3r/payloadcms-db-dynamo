import { BatchWriteCommand, GetCommand } from '@aws-sdk/lib-dynamodb'
import { describe, expect, it, vi } from 'vitest'

import { deleteMany } from '../../src/deleteMany.js'
import { deleteDocuments } from '../../src/utilities/bulkDelete.js'
import * as queryMatchingModule from '../../src/utilities/queryMatching.js'
import { mockAdapter } from '../__helpers/mockAdapter.js'

function postsAdapter(send = vi.fn().mockResolvedValue({})) {
  return mockAdapter({
    send,
    tableName: 'payload',
    payload: {
      collections: {
        posts: {
          config: {
            fields: [{ name: 'title', type: 'text' }],
            sanitizedIndexes: [{ fields: ['title'], unique: true }],
          },
        },
      },
      config: { globals: [] },
      logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn() },
    } as never,
  })
}

describe('deleteDocuments / deleteMany bulk path', () => {
  it('uses BatchWriteCommand in chunks without GetCommand', async () => {
    const send = vi.fn().mockResolvedValue({})
    const adapter = mockAdapter({ send, tableName: 'payload' })

    const docs = Array.from({ length: 26 }, (_, i) => ({
      id: String(i + 1),
      title: `t${i}`,
    }))

    await deleteDocuments(adapter, 'items', docs)

    const batchCalls = send.mock.calls.filter(([cmd]) => cmd instanceof BatchWriteCommand)
    const getCalls = send.mock.calls.filter(([cmd]) => cmd instanceof GetCommand)
    expect(getCalls).toHaveLength(0)
    expect(batchCalls).toHaveLength(2)
    expect(batchCalls[0]?.[0].input.RequestItems?.payload).toHaveLength(25)
    expect(batchCalls[1]?.[0].input.RequestItems?.payload).toHaveLength(1)
  })

  it('delete keys include main row and inverted index rows', async () => {
    const send = vi.fn().mockResolvedValue({})
    const adapter = postsAdapter(send)

    await deleteDocuments(adapter, 'posts', [
      { id: '1', title: 'hello', createdAt: '2025-01-01T00:00:00.000Z' },
    ])

    const batch = send.mock.calls.find(([cmd]) => cmd instanceof BatchWriteCommand)?.[0] as
      | BatchWriteCommand
      | undefined
    const deletes = batch?.input.RequestItems?.payload ?? []
    const keys = deletes.map((d) => d.DeleteRequest?.Key)
    expect(keys).toContainEqual({ pk: 'posts', sk: '1' })
    expect(keys.some((k) => String(k?.pk).startsWith('IDX#posts#title#'))).toBe(true)
  })

  it('dedupes duplicate keys across docs', async () => {
    const send = vi.fn().mockResolvedValue({})
    const adapter = mockAdapter({ send, tableName: 'payload' })

    await deleteDocuments(adapter, 'items', [
      { id: '1', title: 'a' },
      { id: '1', title: 'a' },
    ])

    const batch = send.mock.calls.find(([cmd]) => cmd instanceof BatchWriteCommand)?.[0] as
      | BatchWriteCommand
      | undefined
    const deletes = batch?.input.RequestItems?.payload ?? []
    expect(deletes).toHaveLength(1)
    expect(deletes[0]?.DeleteRequest?.Key).toEqual({ pk: 'items', sk: '1' })
  })

  it('routes deletes through dynamoSend when transaction session is active', async () => {
    const send = vi.fn().mockResolvedValue({})
    const adapter = postsAdapter(send)
    adapter.transactionSessions = {
      tx1: {
        id: 'tx1',
        deleted: new Set(),
        overlay: new Map(),
        transactItems: [],
      },
    }

    await deleteDocuments(adapter, 'posts', [{ id: '1', title: 'x', createdAt: '2025-01-01' }], {
      transactionID: 'tx1',
    } as never)

    expect(send).not.toHaveBeenCalled()
    expect(adapter.transactionSessions?.tx1?.transactItems.length).toBeGreaterThan(0)
    expect(
      adapter.transactionSessions?.tx1?.transactItems.every((item) => item.Delete),
    ).toBe(true)
  })

  it('deleteMany delegates to deleteDocuments', async () => {
    const send = vi.fn().mockResolvedValue({ Items: [] })
    const adapter = postsAdapter(send)
    vi.spyOn(queryMatchingModule, 'queryMatching').mockResolvedValue([
      { id: '1', title: 'x', createdAt: '2025-01-01' },
    ])

    await deleteMany.call(adapter, {
      collection: 'posts',
      where: { title: { equals: 'x' } },
    })

    expect(send.mock.calls.some(([cmd]) => cmd instanceof BatchWriteCommand)).toBe(true)
    expect(send.mock.calls.some(([cmd]) => cmd instanceof GetCommand)).toBe(false)
    vi.restoreAllMocks()
  })
})
