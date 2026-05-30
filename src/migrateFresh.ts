import { DeleteTableCommand, waitUntilTableNotExists } from '@aws-sdk/client-dynamodb'
import type { BaseDatabaseAdapter } from 'payload'
import {
  commitTransaction,
  createLocalReq,
  initTransaction,
  killTransaction,
  readMigrationFiles,
} from 'payload'

import { adapterError } from './packageMeta.js'
import type { DynamoAdapter } from './types.js'

import { ensureTable } from './utilities/ensureTable.js'
import { shouldWarnMigrateFresh } from './utilities/migrateFreshWarn.js'

export const migrateFresh: BaseDatabaseAdapter['migrateFresh'] = async function migrateFresh(
  this: DynamoAdapter,
  { forceAcceptWarning = false } = {},
) {
  const { payload } = this

  if (shouldWarnMigrateFresh(forceAcceptWarning)) {
    payload.logger.warn(
      'migrateFresh will delete the DynamoDB table and re-run all migrations. Pass forceAcceptWarning: true in tests.',
    )
  }

  const client = this.client
  if (!client) {
    throw adapterError('client is not initialized')
  }

  try {
    await client.send(new DeleteTableCommand({ TableName: this.tableName }))
    await waitUntilTableNotExists({ client, maxWaitTime: 60 }, { TableName: this.tableName })
  } catch (err) {
    if (!(err instanceof Error) || err.name !== 'ResourceNotFoundException') {
      throw err
    }
  }

  if (this.ensureTables) {
    await ensureTable(this, this.tableName)
  }

  const migrationFiles = await readMigrationFiles({ payload })
  const req = await createLocalReq({}, payload)

  for (const migration of migrationFiles) {
    try {
      await initTransaction(req)
      await migration.up({
        payload,
        req,
        session: this.transactionSessions?.[String(await req.transactionID!)],
      })
      await payload.create({
        collection: 'payload-migrations',
        data: { name: migration.name, batch: 1 },
        req,
      })
      await commitTransaction(req)
    } catch (err) {
      await killTransaction(req)
      throw err
    }
  }
}
