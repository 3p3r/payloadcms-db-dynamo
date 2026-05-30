import type { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { describe, expect, it } from 'vitest'

import { dynamoAdapter } from '../../src/index.js'
import { resolveTransactionId } from '../../src/transactions/getSession.js'

describe('dynamoAdapter factory', () => {
  it('honors custom args', () => {
    const client = {} as DynamoDBClient
    const adapter = dynamoAdapter({
      tableName: 'custom',
      ensureTables: true,
      client,
      migrationDir: '/tmp/migrations',
      bulkOperationsSingleTransaction: true,
      translateConfig: { marshallOptions: { removeUndefinedValues: false } },
    }).init({ payload: { config: { collections: [], globals: [] } } } as never)

    expect(adapter.tableName).toBe('custom')
    expect(adapter.ensureTables).toBe(true)
    expect(adapter.client).toBe(client)
    expect(adapter.ownsClient).toBe(false)
    expect(adapter.bulkOperationsSingleTransaction).toBe(true)
    expect(adapter.translateConfig.marshallOptions?.removeUndefinedValues).toBe(false)
  })

  it('defaults without an injected client', () => {
    const adapter = dynamoAdapter().init({
      payload: { config: { collections: [], globals: [] } },
    } as never)
    expect(adapter.ownsClient).toBe(true)
    expect(adapter.ensureTables).toBe(false)
  })

  it('resolveTransactionId awaits promise ids', async () => {
    await expect(resolveTransactionId({ transactionID: Promise.resolve('abc') })).resolves.toBe('abc')
    await expect(resolveTransactionId({ transactionID: Promise.resolve(null) })).resolves.toBeUndefined()
  })
})
