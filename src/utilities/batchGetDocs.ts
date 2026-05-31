import { BatchGetCommand } from '@aws-sdk/lib-dynamodb'
import chunk from 'lodash/chunk.js'

import { collectionPk, collectionSk } from '../schema/keys.js'
import type { DynamoAdapter, PartialPayloadRequest } from '../types.js'
import { dynamoSend } from './dynamoSend.js'
import { stripInternalKeys } from './stripInternalKeys.js'

export async function batchGetCollectionDocs(
  adapter: DynamoAdapter,
  collection: string,
  ids: string[],
  req?: PartialPayloadRequest,
): Promise<Record<string, unknown>[]> {
  if (ids.length === 0) return []
  const partition = adapter.resolvePartition(collection)
  const docs: Record<string, unknown>[] = []

  for (const idChunk of chunk(ids, adapter.config.batchGetChunkSize)) {
    const keys = idChunk.map((id) => ({
      pk: collectionPk(partition),
      sk: collectionSk(id),
    }))
    const result = await dynamoSend(
      adapter,
      req,
      new BatchGetCommand({
        RequestItems: {
          [adapter.tableName]: { Keys: keys },
        },
      }),
    )
    for (const item of result.Responses?.[adapter.tableName] ?? []) {
      docs.push(stripInternalKeys(item))
    }
  }

  return docs
}
