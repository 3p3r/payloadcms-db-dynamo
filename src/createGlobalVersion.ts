import type { CreateGlobalVersion } from 'payload'
import { adapterError, DOC_CLIENT_REQUIRED } from './packageMeta.js'

import { TransactWriteCommand } from '@aws-sdk/lib-dynamodb'
import { randomUUID } from 'node:crypto'

import type { DynamoAdapter } from './types.js'

import { applySecondaryWrites } from './index/applySecondaryWrites.js'
import {
  projectVersionIndexes,
  projectVersionLatestPointerDelete,
} from './index/projectVersionIndexes.js'
import { dynamoSend } from './utilities/dynamoSend.js'
import { findFirst } from './utilities/findFirst.js'
import { normalizeForDynamo } from './utilities/normalizeForDynamo.js'
import { projectVersionSnapshot } from './utilities/resolveSchema.js'

/**
 * Like `createVersion` but for global singletons: there's no `parent`, and
 * the "latest" scope is the entire global's versions partition. Same atomic
 * flip+put via `TransactWriteItems`. See `createVersion` for rationale.
 */
export const createGlobalVersion: CreateGlobalVersion = async function createGlobalVersion(
  this: DynamoAdapter,
  {
    autosave,
    createdAt,
    globalSlug,
    publishedLocale,
    returning,
    snapshot,
    updatedAt,
    versionData,
  },
) {
  const docClient = this.docClient
  if (!docClient) {
    throw adapterError(DOC_CLIENT_REQUIRED)
  }

  const partition = this.resolveVersionsPartition(globalSlug)

  const previousLatest = await findFirst(this, {
    partition,
    where: { latest: { equals: true } },
  })

  const id = randomUUID()
  const sanitizedVersionData = projectVersionSnapshot(
    this,
    { kind: 'global', slug: globalSlug },
    versionData as Record<string, unknown>,
  )
  const item: Record<string, unknown> = {
    id,
    version: sanitizedVersionData,
    createdAt,
    updatedAt,
    latest: true,
    autosave,
    ...(snapshot ? { snapshot: true } : {}),
    ...(publishedLocale !== undefined ? { publishedLocale } : {}),
  }

  const indexProjection = projectVersionIndexes({
    collectionSlug: globalSlug,
    versionsPartition: partition,
    versionId: id,
    parentId: globalSlug,
    updatedAt: String(updatedAt),
    latest: true,
    beforeLatest: false,
  })

  const putItem = normalizeForDynamo({
    ...item,
    pk: partition,
    sk: id,
    ...indexProjection.mainAttributes,
  })

  const transactItems: NonNullable<
    ConstructorParameters<typeof TransactWriteCommand>[0]['TransactItems']
  > = []

  if (previousLatest) {
    const prevId = String(previousLatest['id'])
    transactItems.push({
      Update: {
        TableName: this.tableName,
        Key: { pk: partition, sk: prevId },
        UpdateExpression: 'SET #latest = :false',
        ExpressionAttributeNames: { '#latest': 'latest' },
        ExpressionAttributeValues: { ':false': false },
        ConditionExpression: 'attribute_exists(pk)',
      },
    })
    transactItems.push({
      Delete: {
        TableName: this.tableName,
        Key: projectVersionLatestPointerDelete(globalSlug, prevId),
      },
    })
  }

  transactItems.push({
    Put: {
      TableName: this.tableName,
      Item: putItem,
    },
  })

  await dynamoSend(this, undefined, new TransactWriteCommand({ TransactItems: transactItems }))
  await applySecondaryWrites(this, undefined, {
    puts: indexProjection.puts,
    deletes: indexProjection.deletes,
  })

  return returning === false ? (null as never) : (item as never)
}
