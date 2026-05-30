import type { Create } from 'payload'
import { adapterError, DOC_CLIENT_REQUIRED } from './packageMeta.js'

import { PutCommand } from '@aws-sdk/lib-dynamodb'
import { randomUUID } from 'node:crypto'

import type { DynamoAdapter } from './types.js'

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
  // Spread `data` first, then nullish-coalesce timestamps. Explicit values
  // in `data` (versions/restore, migrations backdating) still win, but a
  // payload-passed `data.createdAt = undefined` no longer wipes the default
  // back to undefined — which the marshaller would then drop with
  // `removeUndefinedValues: true`, leaving the row without timestamps.
  const item: Record<string, unknown> = {
    ...data,
    id,
    createdAt: data['createdAt'] ?? now,
    updatedAt: data['updatedAt'] ?? now,
  }
  // Project against the collection's declared fields. DDB has no schema
  // layer, so without this any stray request-body key (notoriously the
  // registration form's `confirm-password`) would persist verbatim.
  const projected = projectForCollection(this, collection, item)

  await dynamoSend(
    this,
    req,
    new PutCommand({
      TableName: this.tableName,
      Item: normalizeForDynamo({
        ...projected,
        pk: this.resolvePartition(collection),
        sk: String(id),
      }),
    }),
  )

  return returning === false ? (null as never) : projected
}
