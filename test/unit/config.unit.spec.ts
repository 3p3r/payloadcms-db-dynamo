import { describe, expect, it } from 'vitest'

import { resolveAdapterConfig } from '../../src/config.js'

describe('resolveAdapterConfig', () => {
  it('merges factory args over rc defaults and clamps batch sizes', () => {
    const config = resolveAdapterConfig({
      tableName: 'custom',
      ensureTables: true,
      bulkOperationsSingleTransaction: true,
    })
    expect(config.tableName).toBe('custom')
    expect(config.ensureTables).toBe(true)
    expect(config.bulkOperationsSingleTransaction).toBe(true)
    expect(config.batchWriteChunkSize).toBe(25)
    expect(config.batchGetChunkSize).toBeLessThanOrEqual(100)
    expect(config.transactChunkSize).toBeLessThanOrEqual(100)
    expect(config.searchNgramLength).toBeGreaterThanOrEqual(1)
  })
})
