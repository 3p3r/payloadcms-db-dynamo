import type { DeleteOne } from 'payload'
import { adapterError, DOC_CLIENT_REQUIRED } from './packageMeta.js'

import { DeleteCommand, GetCommand } from '@aws-sdk/lib-dynamodb'

import type { DynamoAdapter } from './types.js'

import { deleteCollectionIndexes } from './index/applySecondaryWrites.js'
import { findFirst } from './utilities/findFirst.js'
import { dynamoSend } from './utilities/dynamoSend.js'
import { stripInternalKeys } from './utilities/stripInternalKeys.js'
import { whereToId } from './utilities/whereToId.js'

export const deleteOne: DeleteOne = async function deleteOne(
  this: DynamoAdapter,
  { collection, returning, where, req },
) {
  const docClient = this.docClient
  if (!docClient) {
    throw adapterError(DOC_CLIENT_REQUIRED)
  }

  const partition = this.resolvePartition(collection)
  const idFromWhere = whereToId(where)

  let found: Record<string, unknown> | null = null

  if (idFromWhere !== null) {
    const result = await dynamoSend<{ Item?: Record<string, unknown> }>(
      this,
      req,
      new GetCommand({
        TableName: this.tableName,
        Key: { pk: partition, sk: String(idFromWhere) },
        ConsistentRead: true,
      }),
    )
    found = result.Item ? stripInternalKeys(result.Item) : null
  } else {
    found = await findFirst(this, {
      partition,
      where,
      ...(req ? { req } : {}),
    })
  }

  if (!found) {
    return null as never
  }

  await deleteCollectionIndexes(this, collection, found, req)

  await dynamoSend(
    this,
    req,
    new DeleteCommand({
      TableName: this.tableName,
      Key: { pk: partition, sk: String(found['id']) },
    }),
  )

  if (returning === false) {
    return null as never
  }
  return found as never
}
