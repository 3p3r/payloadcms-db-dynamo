import { describe, expect, it } from 'vitest'

import { DEBUG_ROOT, log } from '../../src/log.js'

describe('log', () => {
  it('uses a dash-free debug root namespace', () => {
    expect(DEBUG_ROOT).toBe('payloadcmsDbDynamo')
    expect(DEBUG_ROOT).not.toMatch(/-/)
    expect(log('batchWrite').namespace).toBe('payloadcmsDbDynamo:batchWrite')
  })
})
