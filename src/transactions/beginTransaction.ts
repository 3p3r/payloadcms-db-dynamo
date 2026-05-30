import type { BeginTransaction } from 'payload'
import { v4 as uuid } from 'uuid'

import type { DynamoAdapter } from '../types.js'

import type { DynamoTransactionSession } from './types.js'

export const beginTransaction: BeginTransaction = async function beginTransaction(
  this: DynamoAdapter,
) {
  const id = uuid()
  this.transactionSessions ??= {}
  const session: DynamoTransactionSession = {
    id,
    transactItems: [],
    overlay: new Map(),
    deleted: new Set(),
  }
  this.transactionSessions[id] = session
  return id
}
