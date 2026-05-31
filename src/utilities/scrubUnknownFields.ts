import type { Payload, SanitizedGlobalConfig } from 'payload'

import { PutCommand, QueryCommand } from '@aws-sdk/lib-dynamodb'
import isEqual from 'lodash/isEqual.js'

import { log } from '../log.js'
import { PACKAGE_NAME, adapterError } from '../packageMeta.js'
import type { DynamoAdapter } from '../types.js'

import { normalizeForDynamo } from './normalizeForDynamo.js'
import {
  pickConfiguredFields,
  pickConfiguredVersionRow,
} from './pickConfiguredFields.js'
import { ROW_RESERVED_KEYS } from './resolveSchema.js'
import { stripInternalKeys } from './stripInternalKeys.js'

const scrubLog = log('scrub')

const PRESERVED_ADAPTER_KEYS = [
  'gsi1pk',
  'gsi1sk',
  'gsi2pk',
  'gsi2sk',
  'entityType',
  'collection',
  'field',
  'docId',
] as const

function preservedAdapterAttrs(item: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const key of PRESERVED_ADAPTER_KEYS) {
    if (item[key] !== undefined) out[key] = item[key]
  }
  for (const key of Object.keys(item)) {
    if (key.endsWith('_geohash')) out[key] = item[key]
  }
  return out
}

function requireDynamoAdapter(db: Payload['db']): DynamoAdapter {
  if (
    typeof db !== 'object' ||
    db === null ||
    !('packageName' in db) ||
    db.packageName !== PACKAGE_NAME
  ) {
    throw adapterError('scrubUnknownFields requires payloadcms-db-dynamo adapter.')
  }
  // packageName is the stable discriminator; Payload's DatabaseAdapter type does not
  // model our transaction session shape on `sessions`.
  // @ts-expect-error Payload DatabaseAdapter.sessions differs from DynamoTransactionSession
  return db
}

/**
 * One-shot cleanup pass for rows that were written before write-time
 * projection landed.
 *
 * @example
 *   import { getPayload } from 'payload'
 *   import config from './payload.config'
 *   import { scrubUnknownFields } from 'payloadcms-db-dynamo'
 *
 *   const payload = await getPayload({ config })
 *   const report = await scrubUnknownFields(payload)
 *   payload.logger.info(JSON.stringify(report))
 *   await payload.destroy()
 */
export interface ScrubReport {
  collections: Record<string, { scanned: number; modified: number }>
  collectionVersions: Record<string, { scanned: number; modified: number }>
  globals: Record<string, { scanned: number; modified: number }>
  globalVersions: Record<string, { scanned: number; modified: number }>
}

export async function scrubUnknownFields(payload: Payload): Promise<ScrubReport> {
  const adapter = requireDynamoAdapter(payload.db)
  const docClient = adapter.docClient
  if (!docClient) {
    throw adapterError('scrubUnknownFields requires a connected adapter.')
  }

  scrubLog('starting scrub across collections and globals')

  const report: ScrubReport = {
    collections: {},
    collectionVersions: {},
    globals: {},
    globalVersions: {},
  }

  const collections = adapter.payload?.collections ?? {}
  for (const [slug, collection] of Object.entries(collections)) {
    const fields = collection.config.fields
    report.collections[slug] = await scrubPartition(
      adapter,
      adapter.resolvePartition(slug),
      (row) => pickConfiguredFields(row, fields, ROW_RESERVED_KEYS),
    )

    if (collection.config.versions) {
      report.collectionVersions[slug] = await scrubPartition(
        adapter,
        adapter.resolveVersionsPartition(slug),
        (row) => pickConfiguredVersionRow(row, fields),
      )
    }
  }

  const globals: SanitizedGlobalConfig[] = adapter.payload?.config?.globals ?? []
  for (const global of globals) {
    const fields = global.fields
    report.globals[global.slug] = await scrubPartition(
      adapter,
      adapter.resolvePartition(global.slug),
      (row) => pickConfiguredFields(row, fields, ROW_RESERVED_KEYS),
    )

    if (global.versions) {
      report.globalVersions[global.slug] = await scrubPartition(
        adapter,
        adapter.resolveVersionsPartition(global.slug),
        (row) => pickConfiguredVersionRow(row, fields),
      )
    }
  }

  return report
}

async function scrubPartition(
  adapter: DynamoAdapter,
  partition: string,
  project: (row: Record<string, unknown>) => Record<string, unknown>,
): Promise<{ scanned: number; modified: number }> {
  const docClient = adapter.docClient
  if (!docClient) {
    throw adapterError('scrubUnknownFields requires a connected adapter.')
  }

  let scanned = 0
  let modified = 0
  let exclusiveStartKey: Record<string, unknown> | undefined

  do {
    const result = await docClient.send(
      new QueryCommand({
        TableName: adapter.tableName,
        KeyConditionExpression: 'pk = :pk',
        ExpressionAttributeValues: { ':pk': partition },
        ExclusiveStartKey: exclusiveStartKey,
      }),
    )

    for (const item of result.Items ?? []) {
      if (item['entityType'] === 'idx' || item['entityType'] === 'geo' || item['entityType'] === 'ngm') {
        continue
      }
      scanned++
      const sansInternal = stripInternalKeys(item)
      const projected = project(sansInternal)
      const preserved = preservedAdapterAttrs(item)
      const merged = { ...projected, ...preserved }
      if (!isEqual(sansInternal, merged)) {
        await docClient.send(
          new PutCommand({
            TableName: adapter.tableName,
            Item: normalizeForDynamo({ ...merged, pk: item['pk'], sk: item['sk'] }),
          }),
        )
        modified++
      }
    }

    exclusiveStartKey = result.LastEvaluatedKey
  } while (exclusiveStartKey)

  return { scanned, modified }
}
