import { DeleteCommand, PutCommand } from '@aws-sdk/lib-dynamodb'

import type { DynamoAdapter, PartialPayloadRequest } from '../types.js'
import { dynamoSend } from '../utilities/dynamoSend.js'
import { normalizeForDynamo } from '../utilities/normalizeForDynamo.js'
import type { IndexProjection } from './projector.js'
import { projectCollectionIndexDeletes } from './projector.js'

export async function applySecondaryWrites(
  adapter: DynamoAdapter,
  req: PartialPayloadRequest | undefined,
  projection: Pick<IndexProjection, 'puts' | 'deletes'>,
): Promise<void> {
  for (const key of projection.deletes) {
    await dynamoSend(
      adapter,
      req,
      new DeleteCommand({
        TableName: adapter.tableName,
        Key: key,
      }),
    )
  }
  for (const item of projection.puts) {
    await dynamoSend(
      adapter,
      req,
      new PutCommand({
        TableName: adapter.tableName,
        Item: normalizeForDynamo(item),
      }),
    )
  }
}

export async function deleteCollectionIndexes(
  adapter: DynamoAdapter,
  collection: string,
  doc: Record<string, unknown>,
  req?: PartialPayloadRequest,
): Promise<void> {
  const deletes = projectCollectionIndexDeletes(adapter, collection, doc)
  await applySecondaryWrites(adapter, req, { puts: [], deletes })
}
