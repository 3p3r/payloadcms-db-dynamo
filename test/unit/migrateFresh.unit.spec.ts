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

import { resolveAdapterConfig } from '../../src/config.js'
import { migrateFresh } from '../../src/migrateFresh.js'
import { shouldWarnMigrateFresh } from '../../src/utilities/migrateFreshWarn.js'
import { bareAdapter } from '../__helpers/mockAdapter.js'

describe('migrateFresh', () => {
  it('shouldWarnMigrateFresh respects config and forceAcceptWarning', () => {
    const base = resolveAdapterConfig()
    const warnAdapter = bareAdapter({ config: { ...base, warnOnMigrateFresh: true } })
    const quietAdapter = bareAdapter({ config: { ...base, warnOnMigrateFresh: false } })
    expect(shouldWarnMigrateFresh(warnAdapter, false)).toBe(true)
    expect(shouldWarnMigrateFresh(warnAdapter, true)).toBe(false)
    expect(shouldWarnMigrateFresh(quietAdapter, false)).toBe(false)
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
      config: { ...resolveAdapterConfig(), warnOnMigrateFresh: true },
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
