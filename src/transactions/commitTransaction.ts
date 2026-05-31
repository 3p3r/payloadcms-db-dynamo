import { TransactWriteCommand } from '@aws-sdk/lib-dynamodb'
import type { CommitTransaction } from 'payload'
import chunk from 'lodash/chunk.js'

import { log } from '../log.js'
import { adapterError } from '../packageMeta.js'
import type { DynamoAdapter } from '../types.js'

const txLog = log('transaction')

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

  const chunks = chunk(items, this.config.transactChunkSize)
  txLog('committing %d transact items in %d chunk(s)', items.length, chunks.length)

  for (const transactChunk of chunks) {
    await docClient.send(new TransactWriteCommand({ TransactItems: transactChunk }))
  }
}
