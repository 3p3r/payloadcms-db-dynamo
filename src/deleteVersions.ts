import type { DeleteVersions } from 'payload'
import { adapterError, DOC_CLIENT_REQUIRED } from './packageMeta.js'

import { DeleteCommand } from '@aws-sdk/lib-dynamodb'

import type { DynamoAdapter } from './types.js'

import { projectVersionLatestPointerDelete } from './index/projectVersionIndexes.js'
import { queryMatching } from './utilities/queryMatching.js'

/**
 * Same query + parallel delete pattern as `deleteMany`, but routes to the
 * versions partition for either a collection (`collection`) or a global
 * (`globalSlug`). Payload guarantees exactly one of those two slugs is
 * present.
 */
export const deleteVersions: DeleteVersions = async function deleteVersions(
  this: DynamoAdapter,
  { collection, globalSlug, where },
) {
  const docClient = this.docClient
  if (!docClient) {
    throw adapterError(DOC_CLIENT_REQUIRED)
  }

  const slug = collection ?? globalSlug
  if (!slug) {
    throw adapterError('deleteVersions requires either `collection` or `globalSlug`.')
  }

  const partition = this.resolveVersionsPartition(slug)
  const matched = await queryMatching(this, partition, where)

  await Promise.all(
    matched.map((target) => {
      const deletes = [
        docClient.send(
          new DeleteCommand({
            TableName: this.tableName,
            Key: { pk: partition, sk: String(target['id']) },
          }),
        ),
      ]
      if (target['latest'] === true) {
        deletes.push(
          docClient.send(
            new DeleteCommand({
              TableName: this.tableName,
              Key: projectVersionLatestPointerDelete(slug, String(target['id'])),
            }),
          ),
        )
      }
      return Promise.all(deletes)
    }),
  )
}
