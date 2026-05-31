import type { Create } from 'payload'
import { adapterError, DOC_CLIENT_REQUIRED } from './packageMeta.js'

import { PutCommand } from '@aws-sdk/lib-dynamodb'
import { randomUUID } from 'node:crypto'

import type { DynamoAdapter } from './types.js'

import { applySecondaryWrites } from './index/applySecondaryWrites.js'
import { projectCollectionIndexes } from './index/projector.js'
import { normalizeForDynamo } from './utilities/normalizeForDynamo.js'
import { projectForCollection } from './utilities/resolveSchema.js'

import { dynamoSend } from './utilities/dynamoSend.js'

export const create: Create = async function create(
  this: DynamoAdapter,
  { collection, customID, data, req, returning },
) {
  const docClient = this.docClient
  if (!docClient) {
    throw adapterError(DOC_CLIENT_REQUIRED)
  }

  const id = customID ?? data['id'] ?? randomUUID()
  const now = new Date().toISOString()
  const item: Record<string, unknown> = {
    ...data,
    id,
    createdAt: data['createdAt'] ?? now,
    updatedAt: data['updatedAt'] ?? now,
  }
  const projected = projectForCollection(this, collection, item)
  const indexes = projectCollectionIndexes(this, collection, projected, null)

  await dynamoSend(
    this,
    req,
    new PutCommand({
      TableName: this.tableName,
      Item: normalizeForDynamo({
        ...projected,
        ...indexes.mainAttributes,
        pk: this.resolvePartition(collection),
        sk: String(id),
      }),
    }),
  )

  await applySecondaryWrites(this, req, indexes)

  return returning === false ? (null as never) : projected
}
