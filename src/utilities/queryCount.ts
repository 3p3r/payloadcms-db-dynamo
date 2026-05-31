import type { Where } from 'payload'
import { adapterError, DOC_CLIENT_REQUIRED } from '../packageMeta.js'

import { QueryCommand } from '@aws-sdk/lib-dynamodb'

import type { DynamoAdapter } from '../types.js'

import {
  invertedPk,
  listSpineGsi1pk,
  versionLatestGsi1pk,
  versionParentGsi1pk,
  GSI1_INDEX_NAME,
} from '../schema/keys.js'
import { buildFilterExpression } from './buildFilterExpression.js'
import { compileQuery, type QueryPlan } from './compileQuery.js'
import { whereHasJsOnlyOperator } from './operators.js'
import { queryMatching } from './queryMatching.js'
import { dynamoSend } from './dynamoSend.js'

async function countQueryPages(
  adapter: DynamoAdapter,
  input: ConstructorParameters<typeof QueryCommand>[0],
): Promise<number> {
  const docClient = adapter.docClient
  if (!docClient) throw adapterError(DOC_CLIENT_REQUIRED)

  let totalDocs = 0
  let exclusiveStartKey: Record<string, unknown> | undefined

  while (true) {
    const result = await docClient.send(
      new QueryCommand({
        ...input,
        Select: 'COUNT',
        ...(exclusiveStartKey ? { ExclusiveStartKey: exclusiveStartKey } : {}),
      }),
    )
    totalDocs += result.Count ?? 0
    if (!result.LastEvaluatedKey) break
    exclusiveStartKey = result.LastEvaluatedKey
  }

  return totalDocs
}

async function countGsi1(
  adapter: DynamoAdapter,
  gsi1pk: string,
  where: Where | undefined,
): Promise<number> {
  const filter = buildFilterExpression(where)
  if (filter === null) return 0
  return countQueryPages(adapter, {
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
  })
}

async function countPartition(
  adapter: DynamoAdapter,
  partition: string,
  where: Where | undefined,
): Promise<number> {
  const filter = buildFilterExpression(where)
  if (filter === null) return 0
  return countQueryPages(adapter, {
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
  })
}

async function countInvertedPk(adapter: DynamoAdapter, pk: string): Promise<number> {
  return countQueryPages(adapter, {
    TableName: adapter.tableName,
    KeyConditionExpression: '#pk = :pk',
    ExpressionAttributeNames: { '#pk': 'pk' },
    ExpressionAttributeValues: { ':pk': pk },
    ConsistentRead: true,
  })
}

async function countPlan(
  adapter: DynamoAdapter,
  plan: QueryPlan,
  partition: string,
  where: Where | undefined,
  collection: string,
): Promise<number> {
  if (whereHasJsOnlyOperator(where)) {
    const matched = await queryMatching(adapter, partition, where, undefined, collection)
    return matched.length
  }

  switch (plan.kind) {
    case 'geo':
    case 'inverted-in':
    case 'search-ngram': {
      const matched = await queryMatching(adapter, partition, where, undefined, collection)
      return matched.length
    }
    case 'inverted': {
      let total = await countInvertedPk(adapter, invertedPk(collection, plan.field, plan.value))
      if (plan.remainder) {
        const matched = await queryMatching(adapter, partition, where, undefined, collection)
        return matched.length
      }
      return total
    }
    case 'gsi1-list':
      return countGsi1(adapter, listSpineGsi1pk(plan.collection), plan.where ?? where)
    case 'version-latest-gsi1':
      return countGsi1(adapter, versionLatestGsi1pk(plan.collection), plan.where ?? where)
    case 'version-parent-gsi1':
      return countGsi1(
        adapter,
        versionParentGsi1pk(plan.collection, plan.parentId),
        plan.where ?? where,
      )
    case 'partition':
    default:
      return countPartition(adapter, plan.partition, plan.where ?? where)
  }
}

export async function queryCount(
  adapter: DynamoAdapter,
  partition: string,
  where: undefined | Where,
  collection?: string,
): Promise<number> {
  if (!adapter.docClient) {
    throw adapterError(DOC_CLIENT_REQUIRED)
  }

  const slug = collection ?? partition
  const plan = compileQuery(adapter, slug, where, { partition })
  return countPlan(adapter, plan, partition, where, slug)
}
