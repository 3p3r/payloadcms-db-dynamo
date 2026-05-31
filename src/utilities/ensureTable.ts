import {
  CreateTableCommand,
  DescribeTableCommand,
  waitUntilTableExists,
} from '@aws-sdk/client-dynamodb'

import { log } from '../log.js'
import { PACKAGE_NAME, adapterError } from '../packageMeta.js'
import type { DynamoAdapter } from '../types.js'

import { buildCreateTableInput } from '../schema/tableDefinition.js'

const tableLog = log('ensureTable')

export async function ensureTable(adapter: DynamoAdapter, tableName: string): Promise<void> {
  const client = adapter.client
  if (!client) {
    throw adapterError('client is not initialized — call connect() first.')
  }

  try {
    await client.send(new DescribeTableCommand({ TableName: tableName }))
    tableLog('table %s already exists', tableName)
    return
  } catch (err) {
    if (!(err instanceof Error) || err.name !== 'ResourceNotFoundException') {
      throw err
    }
  }

  adapter.payload.logger.info(`${PACKAGE_NAME}: creating table \`${tableName}\``)
  tableLog('creating table %s', tableName)

  await client.send(new CreateTableCommand(buildCreateTableInput(tableName)))

  await waitUntilTableExists(
    { client, maxWaitTime: adapter.config.tableWaitMaxSeconds },
    { TableName: tableName },
  )
  tableLog('table %s is active', tableName)
}
