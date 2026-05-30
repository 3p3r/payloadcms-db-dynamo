import type { DynamoDBDocumentClientCommand } from '@aws-sdk/lib-dynamodb'
import {
  DeleteCommand as DeleteCommandClass,
  GetCommand as GetCommandClass,
  PutCommand as PutCommandClass,
  QueryCommand as QueryCommandClass,
  TransactWriteCommand,
} from '@aws-sdk/lib-dynamodb'

import type { PartialPayloadRequest } from '../types.js'
import type { DynamoAdapter } from '../types.js'

import { getSession } from '../transactions/getSession.js'
import { itemKey } from '../transactions/types.js'
import { stripInternalKeys } from './stripInternalKeys.js'

export async function dynamoSend<T>(
  adapter: DynamoAdapter,
  req: PartialPayloadRequest | undefined,
  command: DynamoDBDocumentClientCommand<any, any, any, any, any>,
): Promise<T> {
  const session = await getSession(adapter, req)
  if (!session) {
    return adapter.docClient!.send(command) as Promise<T>
  }

  if (command instanceof PutCommandClass) {
    const input = command.input
    const item = input.Item as Record<string, unknown>
    const pk = String(item['pk'])
    const sk = String(item['sk'])
    const key = itemKey(pk, sk)
    session.deleted.delete(key)
    session.overlay.set(key, stripInternalKeys({ ...item }))
    session.transactItems.push({
      Put: {
        TableName: input.TableName,
        Item: item,
        ...(input.ConditionExpression ? { ConditionExpression: input.ConditionExpression } : {}),
      },
    })
    return {} as T
  }

  if (command instanceof DeleteCommandClass) {
    const input = command.input
    const pk = String(input.Key?.['pk'])
    const sk = String(input.Key?.['sk'])
    const key = itemKey(pk, sk)
    const prior = session.overlay.get(key)
    session.deleted.add(key)
    session.overlay.delete(key)
    session.transactItems.push({
      Delete: {
        TableName: input.TableName,
        Key: input.Key,
        ...(input.ConditionExpression ? { ConditionExpression: input.ConditionExpression } : {}),
      },
    })
    if (input.ReturnValues === 'ALL_OLD' && prior) {
      return { Attributes: { ...prior, pk, sk } } as T
    }
    return {} as T
  }

  if (command instanceof GetCommandClass) {
    const input = command.input
    const pk = String(input.Key?.['pk'])
    const sk = String(input.Key?.['sk'])
    const key = itemKey(pk, sk)
    if (session.deleted.has(key)) {
      return { Item: undefined } as T
    }
    const overlay = session.overlay.get(key)
    if (overlay) {
      return {
        Item: {
          ...overlay,
          pk,
          sk,
        },
      } as T
    }
    return adapter.docClient!.send(command) as Promise<T>
  }

  if (command instanceof TransactWriteCommand) {
    const items = command.input.TransactItems ?? []
    session.transactItems.push(...items)
    for (const item of items) {
      if (item.Put?.Item) {
        const row = item.Put.Item as Record<string, unknown>
        const pk = String(row['pk'])
        const sk = String(row['sk'])
        const key = itemKey(pk, sk)
        session.deleted.delete(key)
        session.overlay.set(key, stripInternalKeys({ ...row }))
      }
      if (item.Delete?.Key) {
        const pk = String(item.Delete.Key['pk'])
        const sk = String(item.Delete.Key['sk'])
        const key = itemKey(pk, sk)
        session.deleted.add(key)
        session.overlay.delete(key)
      }
    }
    return {} as T
  }

  const result = (await adapter.docClient!.send(command)) as T & {
    Items?: Record<string, unknown>[]
  }

  if (command instanceof QueryCommandClass && result.Items) {
    result.Items = mergeQueryWithSession(session, result.Items)
  }

  return result
}

function mergeQueryWithSession(
  session: import('../transactions/types.js').DynamoTransactionSession,
  items: Record<string, unknown>[],
): Record<string, unknown>[] {
  const pk = items[0]?.['pk'] as string | undefined
  const filtered = items.filter((item) => {
    const pkVal = String(item['pk'])
    const skVal = String(item['sk'])
    return !session.deleted.has(itemKey(pkVal, skVal))
  })

  const byKey = new Map<string, Record<string, unknown>>()
  for (const item of filtered) {
    byKey.set(itemKey(String(item['pk']), String(item['sk'])), item)
  }

  for (const [key, row] of session.overlay) {
    const [rowPk, rowSk] = key.split('\0')
    if (pk && rowPk !== pk) continue
    if (!session.deleted.has(key)) {
      byKey.set(key, { ...row, pk: rowPk, sk: rowSk })
    }
  }

  return [...byKey.values()]
}
