import type { DeleteMany } from 'payload'
import { adapterError, DOC_CLIENT_REQUIRED } from './packageMeta.js'

import type { DynamoAdapter } from './types.js'

import { deleteOne } from './deleteOne.js'
import { queryMatching } from './utilities/queryMatching.js'

export const deleteMany: DeleteMany = async function deleteMany(
  this: DynamoAdapter,
  { collection, where, req },
) {
  if (!this.docClient) {
    throw adapterError(DOC_CLIENT_REQUIRED)
  }

  const partition = this.resolvePartition(collection)
  const matched = await queryMatching(this, partition, where, req, collection)

  await Promise.all(
    matched.map((target) =>
      deleteOne.call(this, {
        collection,
        where: { id: { equals: target['id'] } },
        returning: false,
        ...(req ? { req } : {}),
      }),
    ),
  )
}
