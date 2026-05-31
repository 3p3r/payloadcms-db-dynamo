import { PutCommand } from '@aws-sdk/lib-dynamodb'
import type { CollectionSlug } from 'payload'

import { applySecondaryWrites } from '../index/applySecondaryWrites.js'
import { projectCollectionIndexes } from '../index/projector.js'
import type { DynamoAdapter, PartialPayloadRequest } from '../types.js'
import { dynamoSend } from './dynamoSend.js'
import { normalizeForDynamo } from './normalizeForDynamo.js'
import { projectForCollection } from './resolveSchema.js'

export type WriteDocumentArgs = {
  collection: CollectionSlug | string
  target: Record<string, unknown>
  data: Record<string, unknown>
  req?: PartialPayloadRequest
  returning?: boolean
}

export async function writeDocument(
  adapter: DynamoAdapter,
  args: WriteDocumentArgs,
): Promise<Record<string, unknown> | null> {
  const updatedAt = args.data['updatedAt'] ?? new Date().toISOString()
  const merged: Record<string, unknown> = {
    ...args.target,
    ...args.data,
    id: args.target['id'],
    updatedAt,
  }
  const projected = projectForCollection(adapter, args.collection, merged)
  const indexes = projectCollectionIndexes(adapter, args.collection, projected, args.target)
  const partition = adapter.resolvePartition(args.collection)

  await dynamoSend(
    adapter,
    args.req,
    new PutCommand({
      TableName: adapter.tableName,
      Item: normalizeForDynamo({
        ...projected,
        ...indexes.mainAttributes,
        pk: partition,
        sk: String(projected['id']),
      }),
      ConditionExpression:
        'attribute_exists(pk) AND (attribute_not_exists(updatedAt) OR updatedAt = :expectedUpdatedAt)',
      ExpressionAttributeValues: { ':expectedUpdatedAt': args.target['updatedAt'] },
    }),
  )

  await applySecondaryWrites(adapter, args.req, indexes)

  if (args.returning === false) {
    return null
  }
  return projected
}
