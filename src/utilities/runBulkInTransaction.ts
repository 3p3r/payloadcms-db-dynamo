import type { DynamoAdapter, PartialPayloadRequest } from '../types.js'
import { beginTransaction } from '../transactions/beginTransaction.js'
import { commitTransaction } from '../transactions/commitTransaction.js'
import { rollbackTransaction } from '../transactions/rollbackTransaction.js'
import { resolveTransactionId } from '../transactions/getSession.js'

export async function runBulkInTransaction<T>(
  adapter: DynamoAdapter,
  req: PartialPayloadRequest | undefined,
  fn: (req: PartialPayloadRequest) => Promise<T>,
): Promise<T> {
  const existingId = await resolveTransactionId(req)
  if (existingId || !adapter.bulkOperationsSingleTransaction) {
    return fn(req ?? {})
  }

  const transactionID = await beginTransaction.call(adapter)
  const bulkReq: PartialPayloadRequest = { ...(req ?? {}), transactionID }

  try {
    const result = await fn(bulkReq)
    await commitTransaction.call(adapter, transactionID)
    return result
  } catch (error) {
    await rollbackTransaction.call(adapter, transactionID)
    throw error
  }
}
