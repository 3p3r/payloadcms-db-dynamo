import type { FindArgs, JoinQuery, PaginatedDocs } from 'payload'

import type { DynamoAdapter } from '../types.js'

import { queryMatching } from './queryMatching.js'

/**
 * Resolve join fields by querying related collections for parent IDs.
 */
export async function resolveJoins(
  adapter: DynamoAdapter,
  args: {
    collectionSlug: string
    docs: Record<string, unknown>[]
    joins?: JoinQuery
    limit?: number
    req?: FindArgs['req']
  },
): Promise<void> {
  const { collectionSlug, docs, joins, req } = args
  if (!joins || docs.length === 0) return

  const collectionConfig = adapter.payload.collections[collectionSlug]?.config
  if (!collectionConfig) return

  const joinFields = collectionConfig.fields.filter((f) => f.type === 'join')

  for (const [joinPath, joinQuery] of Object.entries(joins)) {
    if (!joinQuery) continue

    const joinField = joinFields.find((f) => f.name === joinPath)
    if (!joinField || joinField.type !== 'join') continue

    const targetSlug = Array.isArray(joinField.collection)
      ? joinField.collection[0]
      : joinField.collection
    if (!targetSlug) continue
    const onField = joinField.on
    const limit = joinQuery.limit ?? joinField.defaultLimit ?? 10

    const parentIDs = docs.map((d) => d.id).filter(Boolean)

    const related = await queryMatching(adapter, adapter.resolvePartition(targetSlug), {
      [onField]: { in: parentIDs },
    }, req)

    const grouped: Record<string, Record<string, unknown>[]> = {}
    for (const row of related) {
      const key = String(row[onField])
      if (!grouped[key]) grouped[key] = []
      grouped[key].push(row)
    }

    for (const doc of docs) {
      const id = String(doc.id)
      const slice = (grouped[id] ?? []).slice(0, limit === 0 ? undefined : limit)
      const segments = joinPath.split('.')
      let ref: Record<string, unknown> = doc
      for (let i = 0; i < segments.length - 1; i++) {
        const seg = segments[i]!
        if (!ref[seg]) ref[seg] = {}
        ref = ref[seg] as Record<string, unknown>
      }
      ref[segments[segments.length - 1]!] = {
        docs: slice,
        hasNextPage: false,
        ...(joinQuery.count ? { totalDocs: grouped[id]?.length ?? 0 } : {}),
      }
    }
  }
}
