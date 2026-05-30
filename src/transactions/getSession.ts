import type { PartialPayloadRequest } from '../types.js'
import type { DynamoAdapter } from '../types.js'
import type { DynamoTransactionSession } from './types.js'

export async function resolveTransactionId(
  req?: PartialPayloadRequest,
): Promise<string | undefined> {
  if (!req?.transactionID) return undefined
  if (req.transactionID instanceof Promise) {
    const id = await req.transactionID
    return id === null || id === undefined ? undefined : String(id)
  }
  return String(req.transactionID)
}

export async function getSession(
  adapter: DynamoAdapter,
  req?: PartialPayloadRequest,
): Promise<DynamoTransactionSession | undefined> {
  const id = await resolveTransactionId(req)
  if (!id) return undefined
  return adapter.transactionSessions?.[id]
}
