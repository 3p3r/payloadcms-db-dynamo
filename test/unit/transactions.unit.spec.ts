import { describe, expect, it, vi } from 'vitest'

import { TransactWriteCommand } from '@aws-sdk/lib-dynamodb'

import { deleteMany } from '../../src/deleteMany.js'
import { beginTransaction } from '../../src/transactions/beginTransaction.js'
import { commitTransaction } from '../../src/transactions/commitTransaction.js'
import { rollbackTransaction } from '../../src/transactions/rollbackTransaction.js'
import * as queryMatchingModule from '../../src/utilities/queryMatching.js'
import { mockAdapter } from '../__helpers/mockAdapter.js'

function adapterWithSessions() {
  return mockAdapter({ transactionSessions: {} })
}

describe('transactions', () => {
  it('begin allocates a session id', async () => {
    const adapter = adapterWithSessions()
    const id = await beginTransaction.call(adapter)
    expect(id).toBeTruthy()
    expect(adapter.transactionSessions?.[String(id)]).toBeDefined()
    const second = await beginTransaction.call(adapter)
    expect(second).not.toBe(id)
  })

  it('commit chunks transact items over 100', async () => {
    const adapter = adapterWithSessions()
    const send = vi.fn().mockResolvedValue({})
    adapter.docClient = { send } as never
    adapter.transactionSessions!['tx'] = {
      id: 'tx',
      deleted: new Set(),
      overlay: new Map(),
      transactItems: Array.from({ length: 101 }, (_, i) => ({
        Put: { TableName: 't', Item: { pk: 'p', sk: String(i) } },
      })),
    }
    await commitTransaction.call(adapter, 'tx')
    expect(send).toHaveBeenCalledTimes(2)
  })

  it('commit no-ops for missing or empty sessions', async () => {
    const adapter = adapterWithSessions()
    await expect(commitTransaction.call(adapter, 'missing')).resolves.toBeUndefined()
    adapter.transactionSessions!['empty'] = {
      id: 'empty',
      deleted: new Set(),
      overlay: new Map(),
      transactItems: [],
    }
    await expect(commitTransaction.call(adapter, 'empty')).resolves.toBeUndefined()
  })

  it('commit throws when docClient is missing', async () => {
    const adapter = adapterWithSessions()
    adapter.transactionSessions!['tx'] = {
      id: 'tx',
      deleted: new Set(),
      overlay: new Map(),
      transactItems: [{ Put: { TableName: 't', Item: { pk: 'p', sk: '1' } } }],
    }
    adapter.docClient = undefined
    await expect(commitTransaction.call(adapter, 'tx')).rejects.toThrow(/initialized/)
  })

  it('rollback clears a session', async () => {
    const adapter = adapterWithSessions()
    adapter.transactionSessions!['tx'] = {
      id: 'tx',
      deleted: new Set(),
      overlay: new Map(),
      transactItems: [],
    }
    await rollbackTransaction.call(adapter, 'tx')
    expect(adapter.transactionSessions?.['tx']).toBeUndefined()
  })

  it('commit and rollback accept promise transaction ids', async () => {
    const adapter = adapterWithSessions()
    adapter.transactionSessions!['tx'] = {
      id: 'tx',
      deleted: new Set(),
      overlay: new Map(),
      transactItems: [{ Put: { TableName: 't', Item: { pk: 'p', sk: '1' } } }],
    }
    await commitTransaction.call(adapter, Promise.resolve('tx') as never)
    expect(adapter.transactionSessions?.['tx']).toBeUndefined()

    adapter.transactionSessions!['tx2'] = {
      id: 'tx2',
      deleted: new Set(),
      overlay: new Map(),
      transactItems: [],
    }
    await rollbackTransaction.call(adapter, Promise.resolve('tx2') as never)
    expect(adapter.transactionSessions?.['tx2']).toBeUndefined()
  })

  it('begin reuses an existing session map', async () => {
    const adapter = adapterWithSessions()
    adapter.transactionSessions = { existing: {} as never }
    await beginTransaction.call(adapter)
    expect(adapter.transactionSessions).toBeDefined()
  })

  it('deleteMany buffers deletes in transaction session', async () => {
    const adapter = adapterWithSessions()
    adapter.payload = {
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
    } as never

    const txId = await beginTransaction.call(adapter)
    vi.spyOn(queryMatchingModule, 'queryMatching').mockResolvedValue([
      { id: '1', title: 'a', createdAt: '2025-01-01' },
      { id: '2', title: 'b', createdAt: '2025-01-01' },
    ])

    await deleteMany.call(adapter, {
      collection: 'posts',
      where: {},
      req: { transactionID: txId } as never,
    })

    const session = adapter.transactionSessions?.[String(txId)]
    expect(session?.transactItems.length).toBeGreaterThan(0)
    expect(session?.transactItems.every((item) => item.Delete)).toBe(true)
    vi.restoreAllMocks()
  })

  it('deleteMany commit chunks transact when more than 100 delete keys', async () => {
    const adapter = adapterWithSessions()
    adapter.bulkOperationsSingleTransaction = true
    const send = vi.fn().mockResolvedValue({})
    adapter.docClient = { send } as never

    const docs = Array.from({ length: 101 }, (_, i) => ({ id: String(i + 1), title: `t${i}` }))
    vi.spyOn(queryMatchingModule, 'queryMatching').mockResolvedValue(docs)

    await deleteMany.call(adapter, { collection: 'items', where: {} })

    const transactCalls = send.mock.calls.filter(([cmd]) => cmd instanceof TransactWriteCommand)
    expect(transactCalls.length).toBe(2)
    vi.restoreAllMocks()
  })
})
