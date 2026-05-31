import type { UpdateOne } from 'payload'
import { adapterError, DOC_CLIENT_REQUIRED } from './packageMeta.js'

import { GetCommand } from '@aws-sdk/lib-dynamodb'

import type { DynamoAdapter } from './types.js'

import { findFirst } from './utilities/findFirst.js'
import { dynamoSend } from './utilities/dynamoSend.js'
import { stripInternalKeys } from './utilities/stripInternalKeys.js'
import { writeDocument } from './utilities/writeDocument.js'

export const updateOne: UpdateOne = async function updateOne(this: DynamoAdapter, args) {
  if (!this.docClient) {
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

  return (await writeDocument(this, {
    collection: args.collection,
    target,
    data: args.data,
    ...(args.req ? { req: args.req } : {}),
    returning: args.returning,
  })) as never
}
