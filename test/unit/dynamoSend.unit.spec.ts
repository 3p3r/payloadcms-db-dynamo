import {
  DeleteCommand,
  GetCommand,
  PutCommand,
  QueryCommand,
  TransactWriteCommand,
  UpdateCommand,
} from '@aws-sdk/lib-dynamodb'
import { describe, expect, it, vi } from 'vitest'

import type { DynamoTransactionSession } from '../../src/transactions/types.js'
import type { DynamoAdapter } from '../../src/types.js'
import { dynamoSend } from '../../src/utilities/dynamoSend.js'

function sessionAdapter(session: DynamoTransactionSession): DynamoAdapter {
  return {
    docClient: {
      send: vi.fn().mockResolvedValue({
        Items: [{ pk: 'p', sk: '1', title: 'remote' }],
      }),
    },
    transactionSessions: { tx1: session },
    tableName: 't',
  } as unknown as DynamoAdapter
}

describe('dynamoSend — transaction overlay', () => {
  it('buffers Put, Get, Delete, Query, and TransactWrite', async () => {
    const session: DynamoTransactionSession = {
      deleted: new Set(),
      overlay: new Map(),
      transactItems: [],
    }
    const adapter = sessionAdapter(session)
    const req = { transactionID: 'tx1' }

    await dynamoSend(
      adapter,
      req,
      new PutCommand({
        TableName: 't',
        Item: { pk: 'p', sk: '1', title: 'local' },
        ConditionExpression: 'attribute_not_exists(pk)',
      }),
    )

    const got = await dynamoSend<{ Item?: Record<string, unknown> }>(
      adapter,
      req,
      new GetCommand({ TableName: 't', Key: { pk: 'p', sk: '1' } }),
    )
    expect(got.Item?.title).toBe('local')

    await dynamoSend(
      adapter,
      req,
      new DeleteCommand({
        TableName: 't',
        Key: { pk: 'p', sk: '1' },
        ReturnValues: 'ALL_OLD',
        ConditionExpression: 'attribute_exists(pk)',
      }),
    )

    const deletedOld = await dynamoSend<{ Attributes?: Record<string, unknown> }>(
      adapter,
      req,
      new DeleteCommand({
        TableName: 't',
        Key: { pk: 'p', sk: '9' },
        ReturnValues: 'ALL_OLD',
      }),
    )
    expect(deletedOld.Attributes).toBeUndefined()

    const afterDelete = await dynamoSend<{ Item?: Record<string, unknown> }>(
      adapter,
      req,
      new GetCommand({ TableName: 't', Key: { pk: 'p', sk: '1' } }),
    )
    expect(afterDelete.Item).toBeUndefined()

    await dynamoSend(
      adapter,
      req,
      new PutCommand({
        TableName: 't',
        Item: { pk: 'p', sk: '2', title: 'two' },
      }),
    )

    const queried = await dynamoSend<{ Items?: Record<string, unknown>[] }>(
      adapter,
      req,
      new QueryCommand({
        TableName: 't',
        KeyConditionExpression: '#pk = :pk',
        ExpressionAttributeNames: { '#pk': 'pk' },
        ExpressionAttributeValues: { ':pk': 'p' },
      }),
    )
    expect(queried.Items?.length).toBeGreaterThan(0)
    expect(queried.Items?.every((i) => i.sk !== '1')).toBe(true)

    await dynamoSend(
      adapter,
      req,
      new TransactWriteCommand({
        TransactItems: [
          {
            Delete: {
              TableName: 't',
              Key: { pk: 'p', sk: '2' },
            },
          },
        ],
      }),
    )

    expect(session.transactItems.length).toBeGreaterThan(0)
  })

  it('Get falls through to docClient when key is not in overlay', async () => {
    const send = vi.fn().mockResolvedValue({ Item: { pk: 'p', sk: '9', title: 'remote' } })
    const session: DynamoTransactionSession = {
      deleted: new Set(),
      overlay: new Map(),
      transactItems: [],
    }
    const adapter = {
      docClient: { send },
      transactionSessions: { tx1: session },
      tableName: 't',
    } as unknown as DynamoAdapter
    const got = await dynamoSend<{ Item?: Record<string, unknown> }>(
      adapter,
      { transactionID: 'tx1' },
      new GetCommand({ TableName: 't', Key: { pk: 'p', sk: '9' } }),
    )
    expect(got.Item?.title).toBe('remote')
    expect(send).toHaveBeenCalled()
  })

  it('buffers UpdateCommand in a transaction', async () => {
    const session = {
      id: 'tx1',
      deleted: new Set(),
      overlay: new Map([['p\x001', { pk: 'p', sk: '1', title: 'old' }]]),
      transactItems: [],
    }
    const adapter = {
      docClient: { send: vi.fn() },
      transactionSessions: { tx1: session },
      tableName: 't',
    } as unknown as DynamoAdapter
    await dynamoSend(
      adapter,
      { transactionID: 'tx1' },
      new UpdateCommand({
        TableName: 't',
        Key: { pk: 'p', sk: '1' },
        UpdateExpression: 'SET title = :t',
        ExpressionAttributeValues: { ':t': 'new' },
      }),
    )
    expect(session.transactItems).toHaveLength(1)
    expect(session.transactItems[0]?.Update?.UpdateExpression).toContain('SET title')
  })

  it('passes through when no session is active', async () => {
    const send = vi.fn().mockResolvedValue({ Items: [] })
    const adapter = { docClient: { send } } as unknown as DynamoAdapter
    await dynamoSend(adapter, undefined, new QueryCommand({ TableName: 't' }))
    expect(send).toHaveBeenCalled()
  })

  it('Get returns undefined when key is deleted in session', async () => {
    const session: DynamoTransactionSession = {
      deleted: new Set(['p\x001']),
      overlay: new Map(),
      transactItems: [],
    }
    const adapter = sessionAdapter(session)
    const got = await dynamoSend<{ Item?: Record<string, unknown> }>(
      adapter,
      { transactionID: 'tx1' },
      new GetCommand({ TableName: 't', Key: { pk: 'p', sk: '1' } }),
    )
    expect(got.Item).toBeUndefined()
  })

  it('Query merges overlay rows on the queried partition', async () => {
    const session: DynamoTransactionSession = {
      deleted: new Set(),
      overlay: new Map([['p\x002', { pk: 'p', sk: '2', title: 'overlay' }]]),
      transactItems: [],
    }
    const send = vi.fn().mockResolvedValue({
      Items: [{ pk: 'p', sk: '1', title: 'db' }],
    })
    const adapter = {
      docClient: { send },
      transactionSessions: { tx1: session },
      tableName: 't',
    } as unknown as DynamoAdapter
    const queried = await dynamoSend<{ Items?: Record<string, unknown>[] }>(
      adapter,
      { transactionID: 'tx1' },
      new QueryCommand({
        TableName: 't',
        KeyConditionExpression: '#pk = :pk',
        ExpressionAttributeNames: { '#pk': 'pk' },
        ExpressionAttributeValues: { ':pk': 'p' },
      }),
    )
    expect(queried.Items?.map((i) => i.sk).sort()).toEqual(['1', '2'])
  })

  it('Query with empty Items merges all overlay rows', async () => {
    const session: DynamoTransactionSession = {
      deleted: new Set(),
      overlay: new Map([
        ['p\x001', { pk: 'p', sk: '1', title: 'only-overlay' }],
        ['other\x009', { pk: 'other', sk: '9', title: 'other' }],
      ]),
      transactItems: [],
    }
    const send = vi.fn().mockResolvedValue({ Items: [] })
    const adapter = {
      docClient: { send },
      transactionSessions: { tx1: session },
      tableName: 't',
    } as unknown as DynamoAdapter
    const queried = await dynamoSend<{ Items?: Record<string, unknown>[] }>(
      adapter,
      { transactionID: 'tx1' },
      new QueryCommand({
        TableName: 't',
        KeyConditionExpression: '#pk = :pk',
        ExpressionAttributeValues: { ':pk': 'p' },
      }),
    )
    expect(queried.Items).toHaveLength(2)
  })

  it('TransactWrite updates overlay for nested puts and deletes', async () => {
    const session: DynamoTransactionSession = {
      deleted: new Set(),
      overlay: new Map([['p\x001', { pk: 'p', sk: '1', title: 'old' }]]),
      transactItems: [],
    }
    const adapter = sessionAdapter(session)
    await dynamoSend(
      adapter,
      { transactionID: 'tx1' },
      new TransactWriteCommand({
        TransactItems: [
          {
            Put: {
              TableName: 't',
              Item: { pk: 'p', sk: '3', title: 'three' },
            },
          },
          {
            Delete: {
              TableName: 't',
              Key: { pk: 'p', sk: '1' },
            },
          },
        ],
      }),
    )
    expect(session.overlay.has('p\x003')).toBe(true)
    expect(session.deleted.has('p\x001')).toBe(true)
  })
})
