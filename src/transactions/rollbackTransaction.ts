import type { RollbackTransaction } from 'payload'

import type { DynamoAdapter } from '../types.js'

export const rollbackTransaction: RollbackTransaction = async function rollbackTransaction(
  this: DynamoAdapter,
  incomingID = '',
) {
  const transactionID = incomingID instanceof Promise ? await incomingID : incomingID
  if (this.transactionSessions?.[transactionID]) {
    delete this.transactionSessions[transactionID]
  }
}
