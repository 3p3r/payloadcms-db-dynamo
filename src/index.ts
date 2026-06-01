import type { DatabaseAdapterObj, Payload } from 'payload'

import { createDatabaseAdapter, findMigrationDir } from 'payload'

import { resolveAdapterConfig, resolveTranslateConfig } from './config.js'
import { DEBUG_ROOT } from './log.js'
import { PACKAGE_NAME } from './packageMeta.js'
import type { Args, DynamoAdapter } from './types.js'

import { generateSchema } from './generateSchema.js'
import { migrateFresh } from './migrateFresh.js'
import { beginTransaction } from './transactions/beginTransaction.js'
import { commitTransaction } from './transactions/commitTransaction.js'
import { rollbackTransaction } from './transactions/rollbackTransaction.js'

import { connect } from './connect.js'
import { count } from './count.js'
import { countGlobalVersions } from './countGlobalVersions.js'
import { countVersions } from './countVersions.js'
import { create } from './create.js'
import { createGlobal } from './createGlobal.js'
import { createGlobalVersion } from './createGlobalVersion.js'
import { createVersion } from './createVersion.js'
import { deleteMany } from './deleteMany.js'
import { deleteOne } from './deleteOne.js'
import { deleteVersions } from './deleteVersions.js'
import { destroy } from './destroy.js'
import { find } from './find.js'
import { findDistinct } from './findDistinct.js'
import { findGlobal } from './findGlobal.js'
import { findGlobalVersions } from './findGlobalVersions.js'
import { findOne } from './findOne.js'
import { findVersions } from './findVersions.js'
import { init } from './init.js'
import { queryDrafts } from './queryDrafts.js'
import { updateGlobal } from './updateGlobal.js'
import { updateGlobalVersion } from './updateGlobalVersion.js'
import { updateMany } from './updateMany.js'
import { updateOne } from './updateOne.js'
import { updateVersion } from './updateVersion.js'
import { upsert } from './upsert.js'

export { PACKAGE_NAME } from './packageMeta.js'
export { DEBUG_ROOT } from './log.js'
export type { AdapterRcConfig } from './config.js'
export type { Args, DynamoAdapter } from './types.js'
export { scrubUnknownFields } from './utilities/scrubUnknownFields.js'
export type { ScrubReport } from './utilities/scrubUnknownFields.js'
export type { MigrateDownArgs, MigrateUpArgs } from './exports/migration-utils.js'

const NAME = 'dynamodb'

declare module 'payload' {
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  export interface DatabaseAdapter extends DynamoAdapter {}
}

export function dynamoAdapter(args: Args = {}): DatabaseAdapterObj<DynamoAdapter> {
  function adapterInit({ payload }: { payload: Payload }): DynamoAdapter {
    const config = resolveAdapterConfig(args)
    const migrationDir = findMigrationDir(args.migrationDir)

    const resolvePartition = (slug: string): string => slug
    const resolveVersionsPartition = (slug: string): string => `${slug}_versions`
    const transactionSessions: DynamoAdapter['transactionSessions'] = {}

    // @ts-expect-error createDatabaseAdapter returns BaseDatabaseAdapter; runtime object is DynamoAdapter
    return createDatabaseAdapter({
      name: NAME,
      packageName: PACKAGE_NAME,
      defaultIDType: 'text',
      payload,
      migrationDir,
      bulkOperationsSingleTransaction: config.bulkOperationsSingleTransaction,
      transactionSessions,
      // @ts-expect-error Dynamo transaction sessions extend Payload's session map
      sessions: transactionSessions,

      // ----- adapter-specific state -----
      config,
      clientConfig: args.clientConfig ?? {},
      translateConfig: resolveTranslateConfig(args),
      client: args.client,
      docClient: undefined,
      ownsClient: !args.client,
      tableName: config.tableName,
      ensureTables: config.ensureTables,
      resolvePartition,
      resolveVersionsPartition,

      // ----- lifecycle -----
      connect,
      destroy,
      init,
      generateSchema,
      migrateFresh,

      // ----- transactions -----
      beginTransaction,
      commitTransaction,
      rollbackTransaction,

      // ----- methods -----
      count,
      countGlobalVersions,
      countVersions,
      create,
      createGlobal,
      createGlobalVersion,
      createVersion,
      deleteMany,
      deleteOne,
      deleteVersions,
      find,
      findDistinct,
      findGlobal,
      findGlobalVersions,
      findOne,
      findVersions,
      queryDrafts,
      updateGlobal,
      updateGlobalVersion,
      updateMany,
      updateOne,
      updateVersion,
      upsert,
    }) as DynamoAdapter
  }

  return {
    name: NAME,
    defaultIDType: 'text',
    init: adapterInit,
  }
}
