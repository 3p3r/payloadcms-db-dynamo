import type { UpdateOne } from 'payload'
import { adapterError, DOC_CLIENT_REQUIRED } from './packageMeta.js'

import { GetCommand, PutCommand } from '@aws-sdk/lib-dynamodb'

import type { DynamoAdapter } from './types.js'

import { applySecondaryWrites } from './index/applySecondaryWrites.js'
import { projectCollectionIndexes } from './index/projector.js'
import { findFirst } from './utilities/findFirst.js'
import { dynamoSend } from './utilities/dynamoSend.js'
import { normalizeForDynamo } from './utilities/normalizeForDynamo.js'
import { projectForCollection } from './utilities/resolveSchema.js'
import { stripInternalKeys } from './utilities/stripInternalKeys.js'

export const updateOne: UpdateOne = async function updateOne(this: DynamoAdapter, args) {
  const docClient = this.docClient
  if (!docClient) {
    throw adapterError(DOC_CLIENT_REQUIRED)
  }

  const partition = this.resolvePartition(args.collection)

  let target: null | Record<string, unknown> = null

  if (args.id !== undefined && args.id !== null) {
    const result = await dynamoSend<{ Item?: Record<string, unknown> }>(
      this,
      args.req,
      new GetCommand({
        TableName: this.tableName,
        Key: { pk: partition, sk: String(args.id) },
        ConsistentRead: true,
      }),
    )
    target = result.Item ? stripInternalKeys(result.Item) : null
  } else if (args.where) {
    target = await findFirst(this, {
      partition,
      where: args.where,
      ...(args.req ? { req: args.req } : {}),
    })
  }

  if (!target) {
    return null as never
  }

  const updatedAt = args.data['updatedAt'] ?? new Date().toISOString()
  const merged: Record<string, unknown> = {
    ...target,
    ...args.data,
    id: target['id'],
    updatedAt,
  }
  const projected = projectForCollection(this, args.collection, merged)
  const indexes = projectCollectionIndexes(this, args.collection, projected, target)

  await dynamoSend(
    this,
    args.req,
    new PutCommand({
      TableName: this.tableName,
      Item: normalizeForDynamo({
        ...projected,
        ...indexes.mainAttributes,
        pk: partition,
        sk: String(projected['id']),
      }),
      ConditionExpression:
        'attribute_exists(pk) AND (attribute_not_exists(updatedAt) OR updatedAt = :expectedUpdatedAt)',
      ExpressionAttributeValues: { ':expectedUpdatedAt': target['updatedAt'] },
    }),
  )

  await applySecondaryWrites(this, args.req, indexes)

  if (args.returning === false) {
    return null as never
  }
  return projected as never
}
