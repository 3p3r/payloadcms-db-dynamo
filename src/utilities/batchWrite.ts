import { BatchWriteCommand } from '@aws-sdk/lib-dynamodb'
import { backOff } from 'exponential-backoff'
import chunk from 'lodash/chunk.js'

import type { IndexKey } from '../index/projector.js'
import { log } from '../log.js'
import { adapterError } from '../packageMeta.js'
import type { DynamoAdapter } from '../types.js'

const batchLog = log('batchWrite')

export async function batchDeleteKeys(
  adapter: DynamoAdapter,
  keys: IndexKey[],
): Promise<void> {
  if (keys.length === 0) return
  const docClient = adapter.docClient
  if (!docClient) {
    throw adapterError('client is not initialized')
  }

  const { config } = adapter
  const keyChunks = chunk(keys, config.batchWriteChunkSize)

  for (const keyChunk of keyChunks) {
    let requestItems: BatchWriteCommand['input']['RequestItems'] = {
      [adapter.tableName]: keyChunk.map((key) => ({
        DeleteRequest: { Key: { pk: key.pk, sk: key.sk } },
      })),
    }

    await backOff(
      async () => {
        const result = await docClient.send(new BatchWriteCommand({ RequestItems: requestItems }))
        const unprocessed = result.UnprocessedItems
        if (unprocessed && Object.keys(unprocessed).length > 0) {
          batchLog('retrying %d unprocessed batch write items', Object.keys(unprocessed).length)
          requestItems = unprocessed
          throw new Error('BatchWriteItem has unprocessed items')
        }
      },
      {
        numOfAttempts: config.batchWriteMaxRetries,
        startingDelay: config.batchWriteStartingDelayMs,
        maxDelay: config.batchWriteMaxDelayMs,
        retry: (error) => error instanceof Error && error.message === 'BatchWriteItem has unprocessed items',
      },
    ).catch((err) => {
      if (err instanceof Error && err.message === 'BatchWriteItem has unprocessed items') {
        throw adapterError('BatchWriteItem failed: unprocessed items remain after retries')
      }
      throw err
    })
  }
}
