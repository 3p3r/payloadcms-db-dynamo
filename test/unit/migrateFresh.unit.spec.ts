import { describe, expect, it, vi } from 'vitest'

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
