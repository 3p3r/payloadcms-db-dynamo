import { BatchGetCommand } from '@aws-sdk/lib-dynamodb'

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
  const chunkSize = 100

  for (let i = 0; i < ids.length; i += chunkSize) {
    const chunk = ids.slice(i, i + chunkSize)
    const keys = chunk.map((id) => ({
      pk: collectionPk(partition),
      sk: collectionSk(id),
    }))
    const result = await dynamoSend<{
      Responses?: Record<string, Record<string, unknown>[]>
    }>(
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
