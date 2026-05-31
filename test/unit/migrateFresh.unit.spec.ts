import { describe, expect, it, vi } from 'vitest'

vi.mock('payload', async (importOriginal) => {
  const actual = await importOriginal<typeof import('payload')>()
  return {
    ...actual,
    readMigrationFiles: vi.fn().mockResolvedValue([]),
    createLocalReq: vi.fn().mockResolvedValue({ transactionID: 1 }),
    initTransaction: vi.fn(),
    commitTransaction: vi.fn(),
    killTransaction: vi.fn(),
  }
})

import { migrateFresh } from '../../src/migrateFresh.js'
import { shouldWarnMigrateFresh } from '../../src/utilities/migrateFreshWarn.js'
import { bareAdapter } from '../__helpers/mockAdapter.js'

describe('migrateFresh', () => {
  it('shouldWarnMigrateFresh respects NODE_ENV and forceAcceptWarning', () => {
    const prev = process.env.NODE_ENV
    process.env.NODE_ENV = 'development'
    expect(shouldWarnMigrateFresh(false)).toBe(true)
    expect(shouldWarnMigrateFresh(true)).toBe(false)
    process.env.NODE_ENV = 'test'
    expect(shouldWarnMigrateFresh(false)).toBe(false)
    process.env.NODE_ENV = prev
  })

  it('ignores missing table on delete and warns in development', async () => {
    const prev = process.env.NODE_ENV
    process.env.NODE_ENV = 'development'
    const warn = vi.fn()
    const adapter = bareAdapter({
      client: {
        send: vi
          .fn()
          .mockRejectedValueOnce(
            Object.assign(new Error('missing'), { name: 'ResourceNotFoundException' }),
          ),
      },
      ensureTables: false,
      tableName: 'payload-test',
      payload: {
        logger: { warn, info: vi.fn(), error: vi.fn() },
        create: vi.fn(),
      },
    })
    await migrateFresh.call(adapter, { forceAcceptWarning: false })
    expect(warn).toHaveBeenCalled()
    process.env.NODE_ENV = prev
    vi.restoreAllMocks()
  })

  it('rethrows non-not-found delete errors', async () => {
    const adapter = bareAdapter({
      client: {
        send: vi.fn().mockRejectedValue(
          Object.assign(new Error('denied'), { name: 'AccessDeniedException' }),
        ),
      },
    })
    await expect(migrateFresh.call(adapter, { forceAcceptWarning: true })).rejects.toThrow('denied')
  })
})
