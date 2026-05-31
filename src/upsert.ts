import type { Upsert } from 'payload'
import { adapterError, DOC_CLIENT_REQUIRED } from './packageMeta.js'

import type { DynamoAdapter } from './types.js'

import { create } from './create.js'
import { findFirst } from './utilities/findFirst.js'
import { updateOne } from './updateOne.js'

export const upsert: Upsert = async function upsert(
  this: DynamoAdapter,
  { collection, data, returning, where, req },
) {
  if (!this.docClient) {
    throw adapterError(DOC_CLIENT_REQUIRED)
  }

  const partition = this.resolvePartition(collection)
  const found = await findFirst(this, { partition, where, ...(req ? { req } : {}) })

  if (found) {
    return updateOne.call(this, {
      collection,
      id: String(found['id']),
      data,
      ...(returning !== undefined ? { returning } : {}),
      ...(req ? { req } : {}),
    })
  }

  return create.call(this, {
    collection,
    data,
    ...(returning !== undefined ? { returning } : {}),
    ...(req ? { req } : {}),
  })
}
