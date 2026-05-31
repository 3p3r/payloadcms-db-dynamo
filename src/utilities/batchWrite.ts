import { BatchWriteCommand } from '@aws-sdk/lib-dynamodb'

import type { IndexKey } from '../index/projector.js'
import { adapterError } from '../packageMeta.js'
import type { DynamoAdapter } from '../types.js'

const BATCH_WRITE_CHUNK = 25
const MAX_UNPROCESSED_RETRIES = 8

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export async function batchDeleteKeys(
  adapter: DynamoAdapter,
  keys: IndexKey[],
): Promise<void> {
  if (keys.length === 0) return
  const docClient = adapter.docClient
  if (!docClient) {
    throw adapterError('client is not initialized')
  }

  for (let i = 0; i < keys.length; i += BATCH_WRITE_CHUNK) {
    const chunk = keys.slice(i, i + BATCH_WRITE_CHUNK)
    let requestItems: BatchWriteCommand['input']['RequestItems'] = {
      [adapter.tableName]: chunk.map((key) => ({
        DeleteRequest: { Key: { pk: key.pk, sk: key.sk } },
      })),
    }

    let attempt = 0
    while (requestItems && Object.keys(requestItems).length > 0) {
      const result: { UnprocessedItems?: BatchWriteCommand['input']['RequestItems'] } =
        await docClient.send(new BatchWriteCommand({ RequestItems: requestItems }))
      const unprocessed = result.UnprocessedItems
      if (!unprocessed || Object.keys(unprocessed).length === 0) break

      attempt += 1
      if (attempt > MAX_UNPROCESSED_RETRIES) {
        throw adapterError('BatchWriteItem failed: unprocessed items remain after retries')
      }
      requestItems = unprocessed
      await sleep(Math.min(50 * 2 ** attempt, 2000))
    }
  }
}
