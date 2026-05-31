import type { CreateVersion } from 'payload'
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
 * Insert a new version for a collection's parent doc, maintaining the
 * `latest=true` invariant per parent.
 *
 * Two round trips:
 *  1. `Query` the versions partition for the previous `latest=true` row.
 *  2. `TransactWriteItems` to flip that row's `latest` to false and put the
 *     new row in one atomic call. If a crash occurs mid-flow neither
 *     mutation lands, so we never end up with two `latest=true` rows or
 *     zero. The Update carries `attribute_exists(pk)` so the transaction
 *     fails cleanly if the previous row was deleted between (1) and (2).
 *
 * `autosave` is persisted on the row even though it isn't surfaced in
 * `TypeWithVersion` — `findVersions` filters by it.
 */
export const createVersion: CreateVersion = async function createVersion(
  this: DynamoAdapter,
  {
    autosave,
    collectionSlug,
    createdAt,
    parent,
    publishedLocale,
    req,
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

  const partition = this.resolveVersionsPartition(collectionSlug)

  const previousLatest = await findFirst(this, {
    partition,
    where: { and: [{ parent: { equals: parent } }, { latest: { equals: true } }] },
  })

  const id = randomUUID()
  // Project the snapshot against the parent collection's schema so that any
  // unknown keys (e.g. registration-form `confirm-password`) don't ride into
  // the version row alongside the legitimate doc state.
  const sanitizedVersionData = projectVersionSnapshot(
    this,
    { kind: 'collection', slug: collectionSlug },
    versionData as Record<string, unknown>,
  )
  const item: Record<string, unknown> = {
    id,
    parent,
    version: sanitizedVersionData,
    createdAt,
    updatedAt,
    latest: true,
    autosave,
    ...(snapshot ? { snapshot: true } : {}),
    ...(publishedLocale !== undefined ? { publishedLocale } : {}),
  }

  const indexProjection = projectVersionIndexes({
    collectionSlug,
    versionsPartition: partition,
    versionId: id,
    parentId: String(parent),
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
        Key: projectVersionLatestPointerDelete(collectionSlug, prevId),
      },
    })
  }

  transactItems.push({
    Put: {
      TableName: this.tableName,
      Item: putItem,
    },
  })

  await dynamoSend(this, req, new TransactWriteCommand({ TransactItems: transactItems }))
  await applySecondaryWrites(this, req, {
    puts: indexProjection.puts,
    deletes: indexProjection.deletes,
  })

  return returning === false ? (null as never) : (item as never)
}
