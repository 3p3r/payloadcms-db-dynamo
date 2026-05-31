import type { TranslateConfig } from '@aws-sdk/lib-dynamodb'
import rc = require('rc')

import type { Args } from './types.js'

const RC_APP = 'payloadcms-db-dynamo'

const AWS_BATCH_WRITE_MAX = 25
const AWS_BATCH_GET_MAX = 100
const AWS_TRANSACT_MAX = 100

export const DEFAULT_TRANSLATE_CONFIG: TranslateConfig = {
  marshallOptions: {
    removeUndefinedValues: true,
    convertClassInstanceToMap: true,
  },
}

/** Operational tunables (schema identifiers stay in src/schema/). */
export type AdapterRcConfig = {
  tableName: string
  ensureTables: boolean
  bulkOperationsSingleTransaction: boolean
  warnOnMigrateFresh: boolean
  batchWriteChunkSize: number
  batchWriteMaxRetries: number
  batchWriteStartingDelayMs: number
  batchWriteMaxDelayMs: number
  batchGetChunkSize: number
  transactChunkSize: number
  searchNgramLength: number
  geoHashKeyLength: number
  geoNearDefaultMaxDistanceMeters: number
  tableWaitMaxSeconds: number
}

function envWarnOnMigrateFresh(): boolean {
  return process.env.NODE_ENV !== 'test'
}

const defaultConfig: AdapterRcConfig = {
  tableName: 'payload',
  ensureTables: false,
  bulkOperationsSingleTransaction: false,
  warnOnMigrateFresh: envWarnOnMigrateFresh(),
  batchWriteChunkSize: 25,
  batchWriteMaxRetries: 8,
  batchWriteStartingDelayMs: 50,
  batchWriteMaxDelayMs: 2000,
  batchGetChunkSize: 100,
  transactChunkSize: 100,
  searchNgramLength: 3,
  geoHashKeyLength: 5,
  geoNearDefaultMaxDistanceMeters: 1000,
  tableWaitMaxSeconds: 60,
}

function clampInt(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min
  return Math.min(max, Math.max(min, Math.floor(value)))
}

function mergeRcDefaults(): AdapterRcConfig {
  const fromRc = rc(RC_APP, defaultConfig)
  return validateConfig({
    tableName: fromRc.tableName,
    ensureTables: fromRc.ensureTables,
    bulkOperationsSingleTransaction: fromRc.bulkOperationsSingleTransaction,
    warnOnMigrateFresh: fromRc.warnOnMigrateFresh,
    batchWriteChunkSize: fromRc.batchWriteChunkSize,
    batchWriteMaxRetries: fromRc.batchWriteMaxRetries,
    batchWriteStartingDelayMs: fromRc.batchWriteStartingDelayMs,
    batchWriteMaxDelayMs: fromRc.batchWriteMaxDelayMs,
    batchGetChunkSize: fromRc.batchGetChunkSize,
    transactChunkSize: fromRc.transactChunkSize,
    searchNgramLength: fromRc.searchNgramLength,
    geoHashKeyLength: fromRc.geoHashKeyLength,
    geoNearDefaultMaxDistanceMeters: fromRc.geoNearDefaultMaxDistanceMeters,
    tableWaitMaxSeconds: fromRc.tableWaitMaxSeconds,
  })
}

function validateConfig(config: AdapterRcConfig): AdapterRcConfig {
  return {
    ...config,
    batchWriteChunkSize: clampInt(config.batchWriteChunkSize, 1, AWS_BATCH_WRITE_MAX),
    batchWriteMaxRetries: clampInt(config.batchWriteMaxRetries, 1, 32),
    batchWriteStartingDelayMs: clampInt(config.batchWriteStartingDelayMs, 1, 60_000),
    batchWriteMaxDelayMs: clampInt(config.batchWriteMaxDelayMs, 1, 60_000),
    batchGetChunkSize: clampInt(config.batchGetChunkSize, 1, AWS_BATCH_GET_MAX),
    transactChunkSize: clampInt(config.transactChunkSize, 1, AWS_TRANSACT_MAX),
    searchNgramLength: clampInt(config.searchNgramLength, 1, 32),
    geoHashKeyLength: clampInt(config.geoHashKeyLength, 1, 12),
    geoNearDefaultMaxDistanceMeters: clampInt(config.geoNearDefaultMaxDistanceMeters, 1, 40_075_000),
    tableWaitMaxSeconds: clampInt(config.tableWaitMaxSeconds, 1, 600),
  }
}

/** Resolve rc + env defaults, then apply `dynamoAdapter(args)` overrides. */
export function resolveAdapterConfig(args: Args = {}): AdapterRcConfig {
  const merged = validateConfig(mergeRcDefaults())

  return validateConfig({
    ...merged,
    ...(args.tableName !== undefined ? { tableName: args.tableName } : {}),
    ...(args.ensureTables !== undefined ? { ensureTables: args.ensureTables } : {}),
    ...(args.bulkOperationsSingleTransaction !== undefined
      ? { bulkOperationsSingleTransaction: args.bulkOperationsSingleTransaction }
      : {}),
  })
}

export function resolveTranslateConfig(args: Args): TranslateConfig {
  return args.translateConfig ?? DEFAULT_TRANSLATE_CONFIG
}
