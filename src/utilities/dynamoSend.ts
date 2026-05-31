import type {
  BatchGetCommand,
  BatchGetCommandOutput,
  BatchWriteCommand,
  BatchWriteCommandOutput,
  DeleteCommand,
  DeleteCommandOutput,
  GetCommand,
  GetCommandOutput,
  PutCommand,
  PutCommandOutput,
  QueryCommand,
  QueryCommandOutput,
  TransactWriteCommand,
  TransactWriteCommandOutput,
  UpdateCommand,
  UpdateCommandOutput,
} from '@aws-sdk/lib-dynamodb'
import {
  BatchGetCommand as BatchGetCommandClass,
  BatchWriteCommand as BatchWriteCommandClass,
  DeleteCommand as DeleteCommandClass,
  GetCommand as GetCommandClass,
  PutCommand as PutCommandClass,
  QueryCommand as QueryCommandClass,
  TransactWriteCommand as TransactWriteCommandClass,
  UpdateCommand as UpdateCommandClass,
} from '@aws-sdk/lib-dynamodb'

import { log } from '../log.js'
import { DOC_CLIENT_REQUIRED, adapterError } from '../packageMeta.js'
import type { PartialPayloadRequest } from '../types.js'
import type { DynamoAdapter } from '../types.js'

import { getSession } from '../transactions/getSession.js'
import type { DynamoTransactionSession } from '../transactions/types.js'
import { itemKey } from '../transactions/types.js'
import { stripInternalKeys } from './stripInternalKeys.js'

const sendLog = log('dynamoSend')

export type DynamoSendCommand =
  | BatchGetCommand
  | BatchWriteCommand
  | DeleteCommand
  | GetCommand
  | PutCommand
  | QueryCommand
  | TransactWriteCommand
  | UpdateCommand

const STUB_METADATA = { httpStatusCode: 200 } as const

function requireDocClient(adapter: DynamoAdapter): NonNullable<DynamoAdapter['docClient']> {
  const client = adapter.docClient
  if (!client) {
    throw adapterError(DOC_CLIENT_REQUIRED)
  }
  return client
}

function stubPutOutput(): PutCommandOutput {
  return { $metadata: STUB_METADATA }
}

function stubUpdateOutput(): UpdateCommandOutput {
  return { $metadata: STUB_METADATA }
}

function stubDeleteOutput(): DeleteCommandOutput {
  return { $metadata: STUB_METADATA }
}

function stubTransactOutput(): TransactWriteCommandOutput {
  return { $metadata: STUB_METADATA }
}

export async function dynamoSend(
  adapter: DynamoAdapter,
  req: PartialPayloadRequest | undefined,
  command: GetCommand,
): Promise<GetCommandOutput>
export async function dynamoSend(
  adapter: DynamoAdapter,
  req: PartialPayloadRequest | undefined,
  command: PutCommand,
): Promise<PutCommandOutput>
export async function dynamoSend(
  adapter: DynamoAdapter,
  req: PartialPayloadRequest | undefined,
  command: QueryCommand,
): Promise<QueryCommandOutput>
export async function dynamoSend(
  adapter: DynamoAdapter,
  req: PartialPayloadRequest | undefined,
  command: UpdateCommand,
): Promise<UpdateCommandOutput>
export async function dynamoSend(
  adapter: DynamoAdapter,
  req: PartialPayloadRequest | undefined,
  command: DeleteCommand,
): Promise<DeleteCommandOutput>
export async function dynamoSend(
  adapter: DynamoAdapter,
  req: PartialPayloadRequest | undefined,
  command: TransactWriteCommand,
): Promise<TransactWriteCommandOutput>
export async function dynamoSend(
  adapter: DynamoAdapter,
  req: PartialPayloadRequest | undefined,
  command: BatchGetCommand,
): Promise<BatchGetCommandOutput>
export async function dynamoSend(
  adapter: DynamoAdapter,
  req: PartialPayloadRequest | undefined,
  command: BatchWriteCommand,
): Promise<BatchWriteCommandOutput>
export async function dynamoSend(
  adapter: DynamoAdapter,
  req: PartialPayloadRequest | undefined,
  command: DynamoSendCommand,
): Promise<
  | BatchGetCommandOutput
  | BatchWriteCommandOutput
  | DeleteCommandOutput
  | GetCommandOutput
  | PutCommandOutput
  | QueryCommandOutput
  | TransactWriteCommandOutput
  | UpdateCommandOutput
>
export async function dynamoSend(
  adapter: DynamoAdapter,
  req: PartialPayloadRequest | undefined,
  command: DynamoSendCommand,
): Promise<
  | BatchGetCommandOutput
  | BatchWriteCommandOutput
  | DeleteCommandOutput
  | GetCommandOutput
  | PutCommandOutput
  | QueryCommandOutput
  | TransactWriteCommandOutput
  | UpdateCommandOutput
> {
  const session = await getSession(adapter, req)
  if (!session) {
    sendLog('send %s', command.constructor.name)
    const client = requireDocClient(adapter)
    if (command instanceof GetCommandClass) return client.send(command)
    if (command instanceof PutCommandClass) return client.send(command)
    if (command instanceof QueryCommandClass) return client.send(command)
    if (command instanceof UpdateCommandClass) return client.send(command)
    if (command instanceof DeleteCommandClass) return client.send(command)
    if (command instanceof TransactWriteCommandClass) return client.send(command)
    if (command instanceof BatchGetCommandClass) return client.send(command)
    if (command instanceof BatchWriteCommandClass) return client.send(command)
    throw adapterError('Unsupported DynamoDB command')
  }

  if (command instanceof PutCommandClass) {
    return bufferPut(session, command)
  }

  if (command instanceof UpdateCommandClass) {
    sendLog('buffering Update in transaction session (overlay merge is approximate)')
    return bufferUpdate(session, command)
  }

  if (command instanceof DeleteCommandClass) {
    return bufferDelete(session, command)
  }

  if (command instanceof GetCommandClass) {
    return bufferGet(adapter, session, command)
  }

  if (command instanceof TransactWriteCommandClass) {
    return bufferTransact(session, command)
  }

  if (command instanceof QueryCommandClass) {
    const queryResult = await requireDocClient(adapter).send(command)
    if (queryResult.Items) {
      queryResult.Items = mergeQueryWithSession(session, queryResult.Items)
    }
    return queryResult
  }

  if (command instanceof BatchGetCommandClass) {
    return requireDocClient(adapter).send(command)
  }

  if (command instanceof BatchWriteCommandClass) {
    return requireDocClient(adapter).send(command)
  }

  throw adapterError('Unsupported DynamoDB command in transaction session')
}

function bufferPut(session: DynamoTransactionSession, command: PutCommand): PutCommandOutput {
  const input = command.input
  const item = input.Item
  if (!item || typeof item !== 'object') {
    throw adapterError('PutCommand requires Item')
  }
  const row = item as Record<string, unknown>
  const pk = String(row['pk'])
  const sk = String(row['sk'])
  const key = itemKey(pk, sk)
  session.deleted.delete(key)
  session.overlay.set(key, stripInternalKeys({ ...row }))
  session.transactItems.push({
    Put: {
      TableName: input.TableName,
      Item: item,
      ...(input.ConditionExpression ? { ConditionExpression: input.ConditionExpression } : {}),
      ...(input.ExpressionAttributeNames
        ? { ExpressionAttributeNames: input.ExpressionAttributeNames }
        : {}),
      ...(input.ExpressionAttributeValues
        ? { ExpressionAttributeValues: input.ExpressionAttributeValues }
        : {}),
    },
  })
  return stubPutOutput()
}

function bufferUpdate(session: DynamoTransactionSession, command: UpdateCommand): UpdateCommandOutput {
  const input = command.input
  const pk = String(input.Key?.['pk'])
  const sk = String(input.Key?.['sk'])
  const key = itemKey(pk, sk)
  const prior = session.overlay.get(key)
  const merged = prior
    ? { ...prior, ...input.ExpressionAttributeValues }
    : { pk, sk }
  session.overlay.set(key, stripInternalKeys(merged))
  session.deleted.delete(key)
  session.transactItems.push({
    Update: {
      TableName: input.TableName,
      Key: input.Key,
      UpdateExpression: input.UpdateExpression ?? '',
      ...(input.ExpressionAttributeNames
        ? { ExpressionAttributeNames: input.ExpressionAttributeNames }
        : {}),
      ...(input.ExpressionAttributeValues
        ? { ExpressionAttributeValues: input.ExpressionAttributeValues }
        : {}),
      ...(input.ConditionExpression ? { ConditionExpression: input.ConditionExpression } : {}),
    },
  })
  return stubUpdateOutput()
}

function bufferDelete(session: DynamoTransactionSession, command: DeleteCommand): DeleteCommandOutput {
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
    return { Attributes: { ...prior, pk, sk }, $metadata: STUB_METADATA }
  }
  return stubDeleteOutput()
}

async function bufferGet(
  adapter: DynamoAdapter,
  session: DynamoTransactionSession,
  command: GetCommand,
): Promise<GetCommandOutput> {
  const input = command.input
  const pk = String(input.Key?.['pk'])
  const sk = String(input.Key?.['sk'])
  const key = itemKey(pk, sk)
  if (session.deleted.has(key)) {
    return { Item: undefined, $metadata: STUB_METADATA }
  }
  const overlay = session.overlay.get(key)
  if (overlay) {
    return {
      Item: {
        ...overlay,
        pk,
        sk,
      },
      $metadata: STUB_METADATA,
    }
  }
  return requireDocClient(adapter).send(command)
}

function bufferTransact(
  session: DynamoTransactionSession,
  command: TransactWriteCommand,
): TransactWriteCommandOutput {
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
  return stubTransactOutput()
}

function mergeQueryWithSession(
  session: DynamoTransactionSession,
  items: Record<string, unknown>[],
): Record<string, unknown>[] {
  const firstPk = items[0]?.['pk']
  const pk = typeof firstPk === 'string' ? firstPk : undefined
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
