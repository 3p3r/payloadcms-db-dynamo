import type { Init } from 'payload'

import { log } from './log.js'
import type { DynamoAdapter } from './types.js'

import { ensureConnected } from './utilities/ensureConnected.js'
import { ensureTable } from './utilities/ensureTable.js'

const initLog = log('init')

/**
 * Lifecycle hook called once after the factory `init` returns the adapter.
 * Payload's order is `init → connect`, so we call `ensureConnected` here
 * to populate the client before any DynamoDB operations.
 */
export const init: Init = async function (this: DynamoAdapter) {
  ensureConnected(this)

  initLog(
    'init table=%s ensureTables=%s',
    this.tableName,
    String(this.ensureTables),
  )

  if (this.ensureTables) {
    await ensureTable(this, this.tableName)
    initLog('table ready')
  }
}
