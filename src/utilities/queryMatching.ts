import type { Where } from 'payload'
import { adapterError, DOC_CLIENT_REQUIRED } from '../packageMeta.js'

import { BatchGetCommand, QueryCommand } from '@aws-sdk/lib-dynamodb'
import chunk from 'lodash/chunk.js'

import type { PartialPayloadRequest } from '../types.js'
import type { DynamoAdapter } from '../types.js'

import { queryGeoDocIds } from '../geo/queryGeo.js'
import {
  invertedGsi2pk,
  invertedPk,
  listSpineGsi1pk,
  searchNgramPk,
  versionLatestGsi1pk,
  versionParentGsi1pk,
  GSI1_INDEX_NAME,
  GSI2_INDEX_NAME,
} from '../schema/keys.js'
import { searchNgrams } from '../schema/searchIndex.js'
import { batchGetCollectionDocs } from './batchGetDocs.js'
import { dynamoSend } from './dynamoSend.js'
import { buildFilterExpression } from './buildFilterExpression.js'
import { compileQuery, type QueryPlan } from './compileQuery.js'
import { matchesWhere } from './matchesWhere.js'
import { whereHasJsOnlyOperator } from './operators.js'
import { stripInternalKeys } from './stripInternalKeys.js'


function shouldStop(matched: unknown[], maxItems?: number): boolean {
  return maxItems !== undefined && maxItems > 0 && matched.length >= maxItems
}

async function queryGsi1ByPk(
  adapter: DynamoAdapter,
  gsi1pk: string,
  where: Where | undefined,
  req: PartialPayloadRequest | undefined,
  maxItems?: number,
): Promise<Record<string, unknown>[]> {
  const filter = buildFilterExpression(where)
  if (filter === null) return []
  const matched: Record<string, unknown>[] = []
  let exclusiveStartKey: Record<string, unknown> | undefined

  while (true) {
    const result = await dynamoSend(
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
      matched.push(item)
      if (shouldStop(matched, maxItems)) return matched
    }
    if (!result.LastEvaluatedKey) break
    exclusiveStartKey = result.LastEvaluatedKey
  }

  return matched
}

async function batchGetByKeys(
  adapter: DynamoAdapter,
  keys: Array<{ pk: string; sk: string }>,
  req?: PartialPayloadRequest,
): Promise<Record<string, unknown>[]> {
  if (keys.length === 0) return []

  const docs: Record<string, unknown>[] = []
  for (const keyChunk of chunk(keys, adapter.config.batchGetChunkSize)) {
    const result = await dynamoSend(
      adapter,
      req,
      new BatchGetCommand({
        RequestItems: {
          [adapter.tableName]: {
            Keys: keyChunk.map((k) => ({ pk: k.pk, sk: k.sk })),
          },
        },
      }),
    )
    for (const item of result.Responses?.[adapter.tableName] ?? []) {
      docs.push(stripInternalKeys(item))
    }
  }
  return docs
}

async function queryPartition(
  adapter: DynamoAdapter,
  partition: string,
  where: undefined | Where,
  req?: PartialPayloadRequest,
  maxItems?: number,
): Promise<Record<string, unknown>[]> {
  const filter = buildFilterExpression(where)
  if (filter === null) return []
  const matched: Record<string, unknown>[] = []
  let exclusiveStartKey: Record<string, unknown> | undefined

  while (true) {
    const result = await dynamoSend(
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
      if (item['entityType'] === 'idx' || item['entityType'] === 'geo' || item['entityType'] === 'ngm') {
        continue
      }
      matched.push(stripInternalKeys(item))
      if (shouldStop(matched, maxItems)) return matched
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
  maxItems?: number,
): Promise<Record<string, unknown>[]> {
  const pk = invertedPk(collection, field, value)
  const ids: string[] = []
  let exclusiveStartKey: Record<string, unknown> | undefined

  while (true) {
    const result = await dynamoSend(
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
  if (maxItems !== undefined && maxItems > 0) {
    docs = docs.slice(0, maxItems)
  }
  return docs
}

async function queryGsi2ByPk(
  adapter: DynamoAdapter,
  gsi2pk: string,
  req?: PartialPayloadRequest,
): Promise<Record<string, unknown>[]> {
  const items: Record<string, unknown>[] = []
  let exclusiveStartKey: Record<string, unknown> | undefined

  while (true) {
    const result = await dynamoSend(
      adapter,
      req,
      new QueryCommand({
        TableName: adapter.tableName,
        IndexName: GSI2_INDEX_NAME,
        KeyConditionExpression: '#gpk = :gpk',
        ExpressionAttributeNames: { '#gpk': 'gsi2pk' },
        ExpressionAttributeValues: { ':gpk': gsi2pk },
        ...(exclusiveStartKey ? { ExclusiveStartKey: exclusiveStartKey } : {}),
      }),
    )
    for (const item of result.Items ?? []) {
      items.push(item)
    }
    if (!result.LastEvaluatedKey) break
    exclusiveStartKey = result.LastEvaluatedKey
  }

  return items
}

function buildExcludedInvertedPks(
  collection: string,
  field: string,
  plan: Extract<QueryPlan, { kind: 'reverse-index' }>,
): Set<string> {
  const excluded = new Set<string>()
  if (plan.mode === 'not_equals' && plan.excludeValue !== undefined) {
    excluded.add(invertedPk(collection, field, plan.excludeValue))
  }
  if (plan.mode === 'not_in' && plan.excludeValues) {
    for (const value of plan.excludeValues) {
      excluded.add(invertedPk(collection, field, value))
    }
  }
  return excluded
}

async function queryReverseIndex(
  adapter: DynamoAdapter,
  plan: Extract<QueryPlan, { kind: 'reverse-index' }>,
  req?: PartialPayloadRequest,
  maxItems?: number,
): Promise<Record<string, unknown>[]> {
  const gsi2pk = invertedGsi2pk(plan.collection, plan.field)
  const indexRows = await queryGsi2ByPk(adapter, gsi2pk, req)
  const excludedPks = buildExcludedInvertedPks(plan.collection, plan.field, plan)
  const idSet = new Set<string>()

  for (const item of indexRows) {
    const rowPk = String(item['pk'] ?? '')
    if (excludedPks.size > 0 && excludedPks.has(rowPk)) continue
    const docId = item['docId'] ?? item['sk']
    if (docId) idSet.add(String(docId))
  }

  let docs = await batchGetCollectionDocs(adapter, plan.collection, [...idSet], req)
  if (plan.remainder) {
    docs = docs.filter((row) => matchesWhere(row, plan.remainder))
  }
  if (maxItems !== undefined && maxItems > 0) {
    docs = docs.slice(0, maxItems)
  }
  return docs
}

async function queryInvertedIn(
  adapter: DynamoAdapter,
  collection: string,
  field: string,
  values: unknown[],
  remainder: Where | undefined,
  req?: PartialPayloadRequest,
  maxItems?: number,
): Promise<Record<string, unknown>[]> {
  const idSet = new Set<string>()
  for (const value of values) {
    const pk = invertedPk(collection, field, value)
    let exclusiveStartKey: Record<string, unknown> | undefined
    while (true) {
      const result = await dynamoSend(
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
        if (docId) idSet.add(String(docId))
      }
      if (!result.LastEvaluatedKey) break
      exclusiveStartKey = result.LastEvaluatedKey
    }
  }

  let docs = await batchGetCollectionDocs(adapter, collection, [...idSet], req)
  if (remainder) {
    docs = docs.filter((row) => matchesWhere(row, remainder))
  }
  if (maxItems !== undefined && maxItems > 0) {
    docs = docs.slice(0, maxItems)
  }
  return docs
}

async function queryGsi1List(
  adapter: DynamoAdapter,
  collection: string,
  where: Where | undefined,
  req?: PartialPayloadRequest,
  maxItems?: number,
): Promise<Record<string, unknown>[]> {
  const items = await queryGsi1ByPk(adapter, listSpineGsi1pk(collection), where, req, maxItems)
  const docs: Record<string, unknown>[] = []
  for (const item of items) {
    if (item['entityType'] === 'idx' || item['entityType'] === 'geo' || item['entityType'] === 'ngm') {
      continue
    }
    docs.push(stripInternalKeys(item))
  }
  return docs
}

async function queryVersionLatestGsi1(
  adapter: DynamoAdapter,
  collection: string,
  where: Where | undefined,
  req?: PartialPayloadRequest,
  maxItems?: number,
): Promise<Record<string, unknown>[]> {
  const pointers = await queryGsi1ByPk(
    adapter,
    versionLatestGsi1pk(collection),
    where,
    req,
    maxItems,
  )
  const keys = pointers
    .filter((p) => p['entityType'] === 'ver-latest')
    .map((p) => ({
      pk: String(p['targetPk']),
      sk: String(p['targetSk']),
    }))
  return batchGetByKeys(adapter, keys, req)
}

async function queryVersionParentGsi1(
  adapter: DynamoAdapter,
  collection: string,
  parentId: string,
  where: Where | undefined,
  req?: PartialPayloadRequest,
  maxItems?: number,
): Promise<Record<string, unknown>[]> {
  const items = await queryGsi1ByPk(
    adapter,
    versionParentGsi1pk(collection, parentId),
    where,
    req,
    maxItems,
  )
  return items.map((item) => stripInternalKeys(item))
}

async function querySearchNgramPartition(
  adapter: DynamoAdapter,
  pk: string,
  req?: PartialPayloadRequest,
): Promise<Set<string>> {
  const ids = new Set<string>()
  let exclusiveStartKey: Record<string, unknown> | undefined

  while (true) {
    const result = await dynamoSend(
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
      if (docId) ids.add(String(docId))
    }
    if (!result.LastEvaluatedKey) break
    exclusiveStartKey = result.LastEvaluatedKey
  }

  return ids
}

async function intersectSearchGrams(
  adapter: DynamoAdapter,
  collection: string,
  field: string,
  grams: string[],
  req?: PartialPayloadRequest,
): Promise<Set<string>> {
  let ids: Set<string> | undefined
  for (const gram of grams) {
    const gramIds = await querySearchNgramPartition(
      adapter,
      searchNgramPk(collection, field, gram),
      req,
    )
    if (ids === undefined) {
      ids = gramIds
    } else {
      const next = new Set<string>()
      for (const id of ids) {
        if (gramIds.has(id)) next.add(id)
      }
      ids = next
    }
    if (ids.size === 0) break
  }
  return ids!
}

async function querySearchNgram(
  adapter: DynamoAdapter,
  plan: Extract<QueryPlan, { kind: 'search-ngram' }>,
  where: Where | undefined,
  req?: PartialPayloadRequest,
  maxItems?: number,
): Promise<Record<string, unknown>[]> {
  const grams = searchNgrams(plan.searchText, adapter.config.searchNgramLength)
  const docIds = new Set<string>()
  for (const field of plan.fields) {
    for (const id of await intersectSearchGrams(adapter, plan.collection, field, grams, req)) {
      docIds.add(id)
    }
  }

  let docs = await batchGetCollectionDocs(adapter, plan.collection, [...docIds], req)
  if (where) {
    docs = docs.filter((row) => matchesWhere(row, where))
  }
  if (maxItems !== undefined && maxItems > 0) {
    docs = docs.slice(0, maxItems)
  }
  return docs
}

async function executeGeoPlan(
  adapter: DynamoAdapter,
  plan: Extract<QueryPlan, { kind: 'geo' }>,
  req?: PartialPayloadRequest,
  maxItems?: number,
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
  if (maxItems !== undefined && maxItems > 0) {
    docs = docs.slice(0, maxItems)
  }
  return docs
}

async function executePlan(
  adapter: DynamoAdapter,
  plan: QueryPlan,
  where: undefined | Where,
  req: PartialPayloadRequest | undefined,
  collection: string,
  maxItems: number | undefined,
): Promise<Record<string, unknown>[]> {
  switch (plan.kind) {
    case 'geo':
      return executeGeoPlan(adapter, plan, req, maxItems)
    case 'inverted':
      return queryInvertedIndex(
        adapter,
        collection,
        plan.field,
        plan.value,
        plan.remainder,
        req,
        maxItems,
      )
    case 'inverted-in':
      return queryInvertedIn(adapter, plan.collection, plan.field, plan.values, plan.remainder, req, maxItems)
    case 'reverse-index':
      return queryReverseIndex(adapter, plan, req, maxItems)
    case 'search-ngram':
      return querySearchNgram(adapter, plan, where, req, maxItems)
    case 'gsi1-list':
      return queryGsi1List(adapter, plan.collection, plan.where ?? where, req, maxItems)
    case 'version-latest-gsi1':
      return queryVersionLatestGsi1(adapter, plan.collection, plan.where ?? where, req, maxItems)
    case 'version-parent-gsi1':
      return queryVersionParentGsi1(
        adapter,
        plan.collection,
        plan.parentId,
        plan.where ?? where,
        req,
        maxItems,
      )
    case 'partition':
    default: {
      const effectiveWhere = plan.where ?? where
      if (whereHasJsOnlyOperator(effectiveWhere)) {
        const all = await queryPartition(adapter, plan.partition, undefined, req, maxItems)
        return all.filter((row) => matchesWhere(row, effectiveWhere))
      }
      return queryPartition(adapter, plan.partition, effectiveWhere, req, maxItems)
    }
  }
}

/**
 * Resolve matching collection documents using partition, inverted (IDX#),
 * gsi2 reverse index, GSI1 list spine, geo-index, or version gsi1 queries per `compileQuery`.
 */
export async function queryMatching(
  adapter: DynamoAdapter,
  partition: string,
  where: undefined | Where,
  req?: PartialPayloadRequest,
  collection?: string,
  maxItems?: number,
): Promise<Record<string, unknown>[]> {
  if (!adapter.docClient) {
    throw adapterError(DOC_CLIENT_REQUIRED)
  }

  const slug = collection ?? partition
  const plan = compileQuery(adapter, slug, where, { partition })
  return executePlan(adapter, plan, where, req, slug, maxItems)
}
