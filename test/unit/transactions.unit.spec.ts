import { describe, expect, it, vi } from 'vitest'

import { beginTransaction } from '../../src/transactions/beginTransaction.js'
import { commitTransaction } from '../../src/transactions/commitTransaction.js'
import { rollbackTransaction } from '../../src/transactions/rollbackTransaction.js'
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
})
