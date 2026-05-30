import { DescribeTableCommand, DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { describe, expect, it, vi } from 'vitest'

import type { DynamoAdapter } from '../../src/types.js'
import { ensureTable } from '../../src/utilities/ensureTable.js'
import { TEST_DDB_ENDPOINT } from '../__helpers/assertDbReachable.js'
import { randomTableName } from '../__helpers/randomTableName.js'

describe('ensureTable', () => {
  it('creates a missing table then short-circuits when it already exists', async () => {
    const tableName = randomTableName('ensure')
    const client = new DynamoDBClient({
      endpoint: TEST_DDB_ENDPOINT,
      region: 'us-east-1',
      credentials: { accessKeyId: 'test', secretAccessKey: 'test' },
    })
    const adapter = {
      client,
      payload: { logger: { info: () => {}, warn: () => {}, error: () => {} } },
    } as DynamoAdapter

    await ensureTable(adapter, tableName)
    await ensureTable(adapter, tableName)

    const described = await client.send(new DescribeTableCommand({ TableName: tableName }))
    expect(described.Table?.TableName).toBe(tableName)

    await client.send(new (await import('@aws-sdk/client-dynamodb')).DeleteTableCommand({ TableName: tableName }))
    client.destroy()
  })

  it('throws when client is missing', async () => {
    await expect(
      ensureTable({ client: undefined, payload: { logger: console } } as DynamoAdapter, 'x'),
    ).rejects.toThrow(/client/)
  })

  it('rethrows unexpected errors from the control plane', async () => {
    const client = {
      send: vi.fn().mockRejectedValue(Object.assign(new Error('denied'), { name: 'AccessDeniedException' })),
    }
    await expect(
      ensureTable({ client, payload: { logger: console } } as DynamoAdapter, 't'),
    ).rejects.toThrow('denied')
  })
})
