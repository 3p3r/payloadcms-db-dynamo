import {
  CreateTableCommand,
  DescribeTableCommand,
  waitUntilTableExists,
} from '@aws-sdk/client-dynamodb'

import { PACKAGE_NAME, adapterError } from '../packageMeta.js'
import type { DynamoAdapter } from '../types.js'

import { buildCreateTableInput } from '../schema/tableDefinition.js'

export async function ensureTable(adapter: DynamoAdapter, tableName: string): Promise<void> {
  const client = adapter.client
  if (!client) {
    throw adapterError('client is not initialized — call connect() first.')
  }

  try {
    await client.send(new DescribeTableCommand({ TableName: tableName }))
    return
  } catch (err) {
    if (!(err instanceof Error) || err.name !== 'ResourceNotFoundException') {
      throw err
    }
  }

  adapter.payload.logger.info(`${PACKAGE_NAME}: creating table \`${tableName}\``)

  await client.send(new CreateTableCommand(buildCreateTableInput(tableName)))

  await waitUntilTableExists({ client, maxWaitTime: 60 }, { TableName: tableName })
}
