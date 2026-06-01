import {
  BatchGetCommand,
  DeleteCommand,
  GetCommand,
  PutCommand,
  QueryCommand,
  TransactWriteCommand,
  UpdateCommand,
} from '@aws-sdk/lib-dynamodb'
import { describe, expect, it, vi } from 'vitest'

import type { DynamoTransactionSession } from '../../src/transactions/types.js'
import { dynamoSend } from '../../src/utilities/dynamoSend.js'
import { mockAdapter } from '../__helpers/mockAdapter.js'

function sessionAdapter(session: DynamoTransactionSession) {
  return mockAdapter({
    send: vi.fn().mockResolvedValue({
      Items: [{ pk: 'p', sk: '1', title: 'remote' }],
    }),
    transactionSessions: { tx1: session },
    sessions: { tx1: session },
    tableName: 't',
  })
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

    const got = await dynamoSend(
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

    const deletedOld = await dynamoSend(
      adapter,
      req,
      new DeleteCommand({
        TableName: 't',
        Key: { pk: 'p', sk: '9' },
        ReturnValues: 'ALL_OLD',
      }),
    )
    expect(deletedOld.Attributes).toBeUndefined()

    const afterDelete = await dynamoSend(
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

    const queried = await dynamoSend(
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
    const adapter = mockAdapter({
      send,
      transactionSessions: { tx1: session },
      sessions: { tx1: session },
      tableName: 't',
    })
    const got = await dynamoSend(
      adapter,
      { transactionID: 'tx1' },
      new GetCommand({ TableName: 't', Key: { pk: 'p', sk: '9' } }),
    )
    expect(got.Item?.title).toBe('remote')
    expect(send).toHaveBeenCalled()
  })

  it('buffers UpdateCommand without prior overlay and optional expressions', async () => {
    const session: DynamoTransactionSession = {
      id: 'tx1',
      deleted: new Set(),
      overlay: new Map(),
      transactItems: [],
    }
    const adapter = mockAdapter({
      transactionSessions: { tx1: session },
      sessions: { tx1: session },
      tableName: 't',
    })
    await dynamoSend(
      adapter,
      { transactionID: 'tx1' },
      new UpdateCommand({
        TableName: 't',
        Key: { pk: 'p', sk: '9' },
        UpdateExpression: 'SET title = :t',
        ExpressionAttributeNames: { '#t': 'title' },
        ExpressionAttributeValues: { ':t': 'fresh' },
        ConditionExpression: 'attribute_exists(pk)',
      }),
    )
    expect(session.transactItems[0]?.Update?.ExpressionAttributeNames).toEqual({ '#t': 'title' })
    expect(session.transactItems[0]?.Update?.ConditionExpression).toBe('attribute_exists(pk)')
  })

  it('coalesces Put then Update on the same item to one transact operation', async () => {
    const session: DynamoTransactionSession = {
      id: 'tx1',
      deleted: new Set(),
      overlay: new Map(),
      transactItems: [],
    }
    const adapter = mockAdapter({
      transactionSessions: { tx1: session },
      sessions: { tx1: session },
      tableName: 't',
    })
    const req = { transactionID: 'tx1' }

    await dynamoSend(
      adapter,
      req,
      new PutCommand({
        TableName: 't',
        Item: { pk: 'users', sk: '1', email: 'a@example.com' },
      }),
    )
    await dynamoSend(
      adapter,
      req,
      new UpdateCommand({
        TableName: 't',
        Key: { pk: 'users', sk: '1' },
        UpdateExpression: 'SET #hash = :hash',
        ExpressionAttributeNames: { '#hash': 'hash' },
        ExpressionAttributeValues: { ':hash': 'secret' },
      }),
    )

    expect(session.transactItems).toHaveLength(1)
    expect(session.transactItems[0]?.Put?.Item).toMatchObject({
      pk: 'users',
      sk: '1',
      email: 'a@example.com',
      hash: 'secret',
    })
  })

  it('coalesces create Put then writeDocument Put on the same item (registerFirstUser shape)', async () => {
    const session: DynamoTransactionSession = {
      id: 'tx1',
      deleted: new Set(),
      overlay: new Map(),
      transactItems: [],
    }
    const adapter = mockAdapter({
      transactionSessions: { tx1: session },
      sessions: { tx1: session },
      tableName: 't',
    })
    const req = { transactionID: 'tx1' }

    await dynamoSend(
      adapter,
      req,
      new PutCommand({
        TableName: 't',
        Item: { pk: 'users', sk: '1', email: 'a@example.com', updatedAt: 't1' },
      }),
    )
    await dynamoSend(
      adapter,
      req,
      new PutCommand({
        TableName: 't',
        Item: { pk: 'users', sk: '1', email: 'a@example.com', sessions: [{ id: 's1' }], updatedAt: 't2' },
        ConditionExpression:
          'attribute_exists(pk) AND (attribute_not_exists(updatedAt) OR updatedAt = :expectedUpdatedAt)',
        ExpressionAttributeValues: { ':expectedUpdatedAt': 't1' },
      }),
    )

    expect(session.transactItems).toHaveLength(1)
    const put = session.transactItems[0]?.Put
    expect(put?.ConditionExpression).toBe(
      '(attribute_not_exists(updatedAt) OR updatedAt = :expectedUpdatedAt)',
    )
    expect(put?.Item).toMatchObject({
      email: 'a@example.com',
      sessions: [{ id: 's1' }],
      updatedAt: 't2',
    })
  })

  it('buffers UpdateCommand in a transaction', async () => {
    const session = {
      id: 'tx1',
      deleted: new Set(),
      overlay: new Map([['p\x001', { pk: 'p', sk: '1', title: 'old' }]]),
      transactItems: [],
    }
    const adapter = mockAdapter({
      transactionSessions: { tx1: session },
      sessions: { tx1: session },
      tableName: 't',
    })
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
    const adapter = mockAdapter({ send })
    await dynamoSend(adapter, undefined, new QueryCommand({ TableName: 't' }))
    expect(send).toHaveBeenCalled()
  })

  it('passes BatchGet through when no session is active', async () => {
    const send = vi.fn().mockResolvedValue({ Responses: { t: [] } })
    const adapter = mockAdapter({ send, tableName: 't' })
    await dynamoSend(
      adapter,
      undefined,
      new BatchGetCommand({
        RequestItems: { t: { Keys: [{ pk: 'p', sk: '1' }] } },
      }),
    )
    expect(send).toHaveBeenCalled()
  })

  it('buffered delete without ReturnValues returns stub output', async () => {
    const session: DynamoTransactionSession = {
      deleted: new Set(),
      overlay: new Map([['p\x001', { id: '1', title: 'x' }]]),
      transactItems: [],
    }
    const adapter = sessionAdapter(session)
    const out = await dynamoSend(
      adapter,
      { transactionID: 'tx1' },
      new DeleteCommand({ TableName: 't', Key: { pk: 'p', sk: '1' } }),
    )
    expect(out).toEqual({ $metadata: { httpStatusCode: 200 } })
  })

  it('throws when Put has no Item in a transaction', async () => {
    const session: DynamoTransactionSession = {
      deleted: new Set(),
      overlay: new Map(),
      transactItems: [],
    }
    const adapter = sessionAdapter(session)
    await expect(
      dynamoSend(adapter, { transactionID: 'tx1' }, new PutCommand({ TableName: 't' })),
    ).rejects.toThrow(/Item/)
  })

  it('Get returns undefined when key is deleted in session', async () => {
    const session: DynamoTransactionSession = {
      deleted: new Set(['p\x001']),
      overlay: new Map(),
      transactItems: [],
    }
    const adapter = sessionAdapter(session)
    const got = await dynamoSend(
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
    const adapter = mockAdapter({
      send,
      transactionSessions: { tx1: session },
      sessions: { tx1: session },
      tableName: 't',
    })
    const queried = await dynamoSend(
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
    const adapter = mockAdapter({
      send,
      transactionSessions: { tx1: session },
      sessions: { tx1: session },
      tableName: 't',
    })
    const queried = await dynamoSend(
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
