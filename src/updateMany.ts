import type { UpdateMany } from 'payload'

import type { DynamoAdapter } from './types.js'

import { applySorts } from './utilities/applySorts.js'
import { queryMatching } from './utilities/queryMatching.js'
import { runBulkInTransaction } from './utilities/runBulkInTransaction.js'
import { writeDocument } from './utilities/writeDocument.js'

export const updateMany: UpdateMany = async function updateMany(
  this: DynamoAdapter,
  { collection, data, limit, returning, sort, where, req },
) {
  return runBulkInTransaction(this, req, async (bulkReq) => {
    const partition = this.resolvePartition(collection)
    const matched = await queryMatching(this, partition, where, bulkReq, collection)
    applySorts(matched, sort)

    const targets = limit && limit > 0 ? matched.slice(0, limit) : matched
    if (targets.length === 0) {
      return returning === false ? null : []
    }

    const updated = await Promise.all(
      targets.map((target) =>
        writeDocument(this, {
          collection,
          target,
          data,
          req: bulkReq,
          returning: true,
        }),
      ),
    )

    return returning === false ? null : updated
  })
}
