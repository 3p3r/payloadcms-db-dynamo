import type { Where } from 'payload'
import { adapterError, DOC_CLIENT_REQUIRED } from '../packageMeta.js'

import { QueryCommand } from '@aws-sdk/lib-dynamodb'

import type { PartialPayloadRequest } from '../types.js'
import type { DynamoAdapter } from '../types.js'

import { queryGeoDocIds } from '../geo/queryGeo.js'
import { invertedPk, listSpineGsi1pk, GSI1_INDEX_NAME } from '../schema/keys.js'
import { batchGetCollectionDocs } from './batchGetDocs.js'
import { dynamoSend } from './dynamoSend.js'
import { buildFilterExpression } from './buildFilterExpression.js'
import { compileQuery } from './compileQuery.js'
import { matchesWhere } from './matchesWhere.js'
import { whereHasJsOnlyOperator } from './operators.js'
import { stripInternalKeys } from './stripInternalKeys.js'

async function queryPartition(
  adapter: DynamoAdapter,
  partition: string,
  where: undefined | Where,
  req?: PartialPayloadRequest,
): Promise<Record<string, unknown>[]> {
  const filter = buildFilterExpression(where)
  if (filter === null) return []
  const matched: Record<string, unknown>[] = []
  let exclusiveStartKey: Record<string, unknown> | undefined

  while (true) {
    const result = await dynamoSend<{
      Items?: Record<string, unknown>[]
      LastEvaluatedKey?: Record<string, unknown>
    }>(
      adapter,
      req,
      new QueryCommand({
        TableName: adapter.tableName,
        KeyConditionExpression: '#pk = :pk',
        ExpressionAttributeNames: {
          '#pk': 'pk',
          ...(filter?.names ?? {}),
        },
        ExpressionAttributeValues: {
          ':pk': partition,
          ...(filter?.values ?? {}),
        },
        ConsistentRead: true,
        ...(filter ? { FilterExpression: filter.expression } : {}),
        ...(exclusiveStartKey ? { ExclusiveStartKey: exclusiveStartKey } : {}),
      }),
    )
    for (const item of result.Items ?? []) {
      if (item['entityType'] === 'idx' || item['entityType'] === 'geo') continue
      matched.push(stripInternalKeys(item))
    }
    if (!result.LastEvaluatedKey) break
    exclusiveStartKey = result.LastEvaluatedKey
  }

  return matched
}

async function queryInvertedIndex(
  adapter: DynamoAdapter,
  collection: string,
  field: string,
  value: unknown,
  remainder: Where | undefined,
  req?: PartialPayloadRequest,
): Promise<Record<string, unknown>[]> {
  const pk = invertedPk(collection, field, value)
  const ids: string[] = []
  let exclusiveStartKey: Record<string, unknown> | undefined

  while (true) {
    const result = await dynamoSend<{
      Items?: Record<string, unknown>[]
      LastEvaluatedKey?: Record<string, unknown>
    }>(
      adapter,
      req,
      new QueryCommand({
        TableName: adapter.tableName,
        KeyConditionExpression: '#pk = :pk',
        ExpressionAttributeNames: { '#pk': 'pk' },
        ExpressionAttributeValues: { ':pk': pk },
        ConsistentRead: true,
        ...(exclusiveStartKey ? { ExclusiveStartKey: exclusiveStartKey } : {}),
      }),
    )
    for (const item of result.Items ?? []) {
      const docId = item['docId'] ?? item['sk']
      if (docId) ids.push(String(docId))
    }
    if (!result.LastEvaluatedKey) break
    exclusiveStartKey = result.LastEvaluatedKey
  }

  let docs = await batchGetCollectionDocs(adapter, collection, ids, req)
  if (remainder) {
    docs = docs.filter((row) => matchesWhere(row, remainder))
  }
  return docs
}

async function queryGsi1List(
  adapter: DynamoAdapter,
  collection: string,
  where: Where | undefined,
  req?: PartialPayloadRequest,
): Promise<Record<string, unknown>[]> {
  const gsi1pk = listSpineGsi1pk(collection)
  const filter = buildFilterExpression(where)
  if (filter === null) return []
  const matched: Record<string, unknown>[] = []
  let exclusiveStartKey: Record<string, unknown> | undefined

  while (true) {
    const result = await dynamoSend<{
      Items?: Record<string, unknown>[]
      LastEvaluatedKey?: Record<string, unknown>
    }>(
      adapter,
      req,
      new QueryCommand({
        TableName: adapter.tableName,
        IndexName: GSI1_INDEX_NAME,
        KeyConditionExpression: '#gpk = :gpk',
        ExpressionAttributeNames: {
          '#gpk': 'gsi1pk',
          ...(filter?.names ?? {}),
        },
        ExpressionAttributeValues: {
          ':gpk': gsi1pk,
          ...(filter?.values ?? {}),
        },
        ...(filter ? { FilterExpression: filter.expression } : {}),
        ...(exclusiveStartKey ? { ExclusiveStartKey: exclusiveStartKey } : {}),
      }),
    )
    for (const item of result.Items ?? []) {
      matched.push(stripInternalKeys(item))
    }
    if (!result.LastEvaluatedKey) break
    exclusiveStartKey = result.LastEvaluatedKey
  }

  return matched
}

async function executeGeoPlan(
  adapter: DynamoAdapter,
  plan: Extract<import('./compileQuery.js').QueryPlan, { kind: 'geo' }>,
  req?: PartialPayloadRequest,
): Promise<Record<string, unknown>[]> {
  const docIds = await queryGeoDocIds(
    adapter,
    plan.collection,
    plan.field,
    plan.operator,
    plan.clause,
    req,
  )
  if (!docIds || docIds.size === 0) return []
  let docs = await batchGetCollectionDocs(adapter, plan.collection, [...docIds], req)

  const geoClause = {
    [plan.field]: { [plan.operator]: plan.clause },
  } as Where
  docs = docs.filter((d) => matchesWhere(d, geoClause))

  if (plan.remainder) {
    docs = docs.filter((d) => matchesWhere(d, plan.remainder))
  }
  return docs
}

/**
 * Resolve matching collection documents using partition, inverted (IDX#),
 * GSI1 list spine, or geo-index queries per `compileQuery`.
 */
export async function queryMatching(
  adapter: DynamoAdapter,
  partition: string,
  where: undefined | Where,
  req?: PartialPayloadRequest,
  collection?: string,
): Promise<Record<string, unknown>[]> {
  if (!adapter.docClient) {
    throw adapterError(DOC_CLIENT_REQUIRED)
  }

  const slug = collection ?? partition
  const plan = compileQuery(adapter, slug, where)

  switch (plan.kind) {
    case 'geo':
      return executeGeoPlan(adapter, plan, req)
    case 'inverted':
      return queryInvertedIndex(adapter, slug, plan.field, plan.value, plan.remainder, req)
    case 'gsi1-list':
      return queryGsi1List(adapter, slug, where, req)
    case 'partition':
    default: {
      const effectiveWhere = plan.where ?? where
      if (whereHasJsOnlyOperator(effectiveWhere)) {
        const all = await queryPartition(adapter, plan.partition, undefined, req)
        return all.filter((row) => matchesWhere(row, effectiveWhere))
      }
      return queryPartition(adapter, plan.partition, effectiveWhere, req)
    }
  }
}
