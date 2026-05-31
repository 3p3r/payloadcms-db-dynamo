import { DescribeTableCommand, DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { describe, expect, it, vi } from 'vitest'

import { ensureTable } from '../../src/utilities/ensureTable.js'
import { mockAdapter } from '../__helpers/mockAdapter.js'
import { TEST_DDB_ENDPOINT } from '../__helpers/assertDbReachable.js'
import { randomTableName } from '../__helpers/randomTableName.js'

async function isDdbUp(): Promise<boolean> {
  const client = new DynamoDBClient({
    endpoint: TEST_DDB_ENDPOINT,
    region: 'us-east-1',
    credentials: { accessKeyId: 'test', secretAccessKey: 'test' },
    maxAttempts: 1,
  })
  try {
    await client.send(new DescribeTableCommand({ TableName: '___probe___' }))
    return true
  } catch (err) {
    const name = (err as { name?: string }).name
    if (name === 'ResourceNotFoundException') return true
    return false
  } finally {
    client.destroy()
  }
}

const ddbUp = await isDdbUp()

describe('ensureTable', () => {
  it.skipIf(!ddbUp)('creates a missing table then short-circuits when it already exists', async () => {
    const tableName = randomTableName('ensure')
    const client = new DynamoDBClient({
      endpoint: TEST_DDB_ENDPOINT,
      region: 'us-east-1',
      credentials: { accessKeyId: 'test', secretAccessKey: 'test' },
    })
    const adapter = mockAdapter({
      client,
      payload: { logger: { info: () => {}, warn: () => {}, error: () => {} } },
    })

    await ensureTable(adapter, tableName)
    await ensureTable(adapter, tableName)

    const described = await client.send(new DescribeTableCommand({ TableName: tableName }))
    expect(described.Table?.TableName).toBe(tableName)

    await client.send(new (await import('@aws-sdk/client-dynamodb')).DeleteTableCommand({ TableName: tableName }))
    client.destroy()
  })

  it('throws when client is missing', async () => {
    await expect(
      ensureTable(mockAdapter({ client: undefined, payload: { logger: console } }), 'x'),
    ).rejects.toThrow(/client/)
  })

  it('rethrows unexpected errors from the control plane', async () => {
    const client = {
      send: vi.fn().mockRejectedValue(Object.assign(new Error('denied'), { name: 'AccessDeniedException' })),
    }
    await expect(
      ensureTable(mockAdapter({ client, payload: { logger: console } }), 't'),
    ).rejects.toThrow('denied')
  })
})
