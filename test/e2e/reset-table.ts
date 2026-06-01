import {
  CreateTableCommand,
  DeleteTableCommand,
  DynamoDBClient,
  waitUntilTableExists,
  waitUntilTableNotExists,
} from '@aws-sdk/client-dynamodb'

import { buildCreateTableInput } from '../../dist/schema/tableDefinition.js'
import { TEST_DDB_ENDPOINT } from '../__helpers/assertDbReachable.js'

function dynamoClient(): DynamoDBClient {
  return new DynamoDBClient({
    endpoint: process.env.DYNAMODB_ENDPOINT ?? TEST_DDB_ENDPOINT,
    region: process.env.AWS_REGION ?? 'us-east-1',
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID ?? 'test',
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY ?? 'test',
    },
  })
}

/** Drop and recreate a kitchen-sink example table (no Payload boot — avoids ESM/rc in globalSetup). */
export async function resetTableByName(tableName: string): Promise<void> {
  const client = dynamoClient()
  try {
    await client.send(new DeleteTableCommand({ TableName: tableName }))
    await waitUntilTableNotExists({ client, maxWaitTime: 120 }, { TableName: tableName })
  } catch (err) {
    if ((err as Error).name !== 'ResourceNotFoundException') {
      throw err
    }
  }
  await client.send(new CreateTableCommand(buildCreateTableInput(tableName)))
  await waitUntilTableExists({ client, maxWaitTime: 120 }, { TableName: tableName })
  client.destroy()
}

export async function resetExampleTables(): Promise<void> {
  await resetTableByName('payload-kitchen-sink-3')
  await resetTableByName('payload-kitchen-sink-4')
}
