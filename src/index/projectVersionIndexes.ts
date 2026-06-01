import {
  versionGsi1sk,
  versionLatestGsi1pk,
  versionLatestPointerPk,
  versionLatestPointerSk,
  versionParentGsi1pk,
} from '../schema/keys.js'

export type VersionIndexProjection = {
  mainAttributes: Record<string, unknown>
  puts: Record<string, unknown>[]
  deletes: Array<{ pk: string; sk: string }>
}

export function projectVersionIndexes(args: {
  collectionSlug: string
  versionsPartition: string
  versionId: string
  parentId: string
  updatedAt: string
  latest: boolean
  beforeLatest: boolean
}): VersionIndexProjection {
  const { collectionSlug, versionsPartition, versionId, parentId, updatedAt, latest, beforeLatest } =
    args
  const gsi1sk = versionGsi1sk(String(updatedAt), versionId)
  const mainAttributes: Record<string, unknown> = {
    gsi1pk: versionParentGsi1pk(collectionSlug, parentId),
    gsi1sk,
  }

  const puts: Record<string, unknown>[] = []
  const deletes: Array<{ pk: string; sk: string }> = []

  if (latest) {
    puts.push({
      pk: versionLatestPointerPk(collectionSlug),
      sk: versionLatestPointerSk(versionId),
      entityType: 'ver-latest',
      collection: collectionSlug,
      targetPk: versionsPartition,
      targetSk: versionId,
      gsi1pk: versionLatestGsi1pk(collectionSlug),
      gsi1sk,
      parent: parentId,
      latest: true,
    })
  }

  if (beforeLatest && !latest) {
    deletes.push({
      pk: versionLatestPointerPk(collectionSlug),
      sk: versionLatestPointerSk(versionId),
    })
  }

  return { mainAttributes, puts, deletes }
}

export function projectVersionLatestPointerDelete(
  collectionSlug: string,
  versionId: string,
): { pk: string; sk: string } {
  return {
    pk: versionLatestPointerPk(collectionSlug),
    sk: versionLatestPointerSk(versionId),
  }
}
