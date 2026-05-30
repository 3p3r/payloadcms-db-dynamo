import { TransactWriteCommand } from '@aws-sdk/lib-dynamodb'
import type { CommitTransaction } from 'payload'

import { adapterError } from '../packageMeta.js'
import type { DynamoAdapter } from '../types.js'

const MAX_TRANSACT_ITEMS = 100

export const commitTransaction: CommitTransaction = async function commitTransaction(
  this: DynamoAdapter,
  incomingID = '',
) {
  const transactionID = incomingID instanceof Promise ? await incomingID : incomingID
  const session = this.transactionSessions?.[String(transactionID)]
  if (!session) return

  const docClient = this.docClient
  if (!docClient) {
    throw adapterError('client is not initialized')
  }

  delete this.transactionSessions[String(transactionID)]

  const items = session.transactItems
  if (items.length === 0) return

  for (let i = 0; i < items.length; i += MAX_TRANSACT_ITEMS) {
    const chunk = items.slice(i, i + MAX_TRANSACT_ITEMS)
    await docClient.send(new TransactWriteCommand({ TransactItems: chunk }))
  }
}
