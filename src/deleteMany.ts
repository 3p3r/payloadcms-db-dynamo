import type { DeleteMany } from 'payload'

import type { DynamoAdapter } from './types.js'

import { deleteDocuments } from './utilities/bulkDelete.js'
import { queryMatching } from './utilities/queryMatching.js'
import { runBulkInTransaction } from './utilities/runBulkInTransaction.js'

export const deleteMany: DeleteMany = async function deleteMany(
  this: DynamoAdapter,
  { collection, where, req },
) {
  await runBulkInTransaction(this, req, async (bulkReq) => {
    const partition = this.resolvePartition(collection)
    const matched = await queryMatching(this, partition, where, bulkReq, collection)
    await deleteDocuments(this, collection, matched, bulkReq)
  })
}
