import { DeleteCommand } from '@aws-sdk/lib-dynamodb'
import type { CollectionSlug } from 'payload'

import {
  mainItemKeys,
  projectCollectionIndexDeletes,
  type IndexKey,
} from '../index/projector.js'
import { getSession } from '../transactions/getSession.js'
import { itemKey } from '../transactions/types.js'
import type { DynamoAdapter, PartialPayloadRequest } from '../types.js'
import { batchDeleteKeys } from './batchWrite.js'
import { dynamoSend } from './dynamoSend.js'

function collectDeleteKeys(
  adapter: DynamoAdapter,
  collection: CollectionSlug | string,
  docs: Record<string, unknown>[],
): IndexKey[] {
  const seen = new Set<string>()
  const keys: IndexKey[] = []

  for (const doc of docs) {
    const id = String(doc['id'])
    const main = mainItemKeys(adapter, collection, id)
    const mainKey = itemKey(main.pk, main.sk)
    if (!seen.has(mainKey)) {
      seen.add(mainKey)
      keys.push(main)
    }

    for (const indexKey of projectCollectionIndexDeletes(adapter, collection, doc)) {
      const k = itemKey(indexKey.pk, indexKey.sk)
      if (!seen.has(k)) {
        seen.add(k)
        keys.push(indexKey)
      }
    }
  }

  return keys
}

export async function deleteDocuments(
  adapter: DynamoAdapter,
  collection: CollectionSlug | string,
  docs: Record<string, unknown>[],
  req?: PartialPayloadRequest,
): Promise<void> {
  const keys = collectDeleteKeys(adapter, collection, docs)
  const session = await getSession(adapter, req)

  if (session) {
    for (const key of keys) {
      await dynamoSend(
        adapter,
        req,
        new DeleteCommand({
          TableName: adapter.tableName,
          Key: { pk: key.pk, sk: key.sk },
        }),
      )
    }
    return
  }

  await batchDeleteKeys(adapter, keys)
}
