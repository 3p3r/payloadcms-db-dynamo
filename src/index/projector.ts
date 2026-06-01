import type { CollectionSlug } from 'payload'

import { geohashForPoint } from '../geo/geohash.js'
import { parsePoint } from '../geo/distance.js'
import { collectDeclaredIndexPaths, collectPointFields } from '../schema/collectFields.js'
import {
  collectionPk,
  collectionSk,
  geoGsi2pk,
  geoPk,
  geoSk,
  invertedGsi2pk,
  invertedPk,
  invertedSk,
  listSpineGsi1pk,
  listSpineGsi1sk,
  normalizeIndexValue,
} from '../schema/keys.js'
import type { DynamoAdapter } from '../types.js'
import { getCollectionFields } from '../utilities/resolveSchema.js'
import { getPath } from '../utilities/getPath.js'
import { projectSearchIndex } from './projectSearchIndex.js'

export type IndexKey = { pk: string; sk: string }

export type IndexProjection = {
  /** Attributes merged onto the main collection item (e.g. gsi1pk/gsi1sk). */
  mainAttributes: Record<string, unknown>
  puts: Record<string, unknown>[]
  deletes: IndexKey[]
}

function listSortValue(doc: Record<string, unknown>, sortField: string): string {
  const raw = getPath(doc, sortField)
  if (raw === undefined || raw === null) return ''
  return normalizeIndexValue(raw)
}

export function projectCollectionIndexes(
  adapter: DynamoAdapter,
  collection: CollectionSlug | string,
  doc: Record<string, unknown>,
  before: Record<string, unknown> | null,
): IndexProjection {
  const slug = String(collection)
  const id = String(doc['id'])
  const config = adapter.payload?.collections?.[slug]?.config
  const fields = getCollectionFields(adapter, slug) ?? config?.fields ?? []

  const indexPaths = config ? collectDeclaredIndexPaths(config) : []
  const pointPaths = collectPointFields(fields)

  const mainAttributes: Record<string, unknown> = {}
  const puts: Record<string, unknown>[] = []
  const deletes: IndexKey[] = []

  const sortField = indexPaths[0] ?? 'createdAt'
  const geoHashKeyLength = adapter.config.geoHashKeyLength
  mainAttributes.gsi1pk = listSpineGsi1pk(slug)
  mainAttributes.gsi1sk = listSpineGsi1sk(listSortValue(doc, sortField), id)

  for (const path of indexPaths) {
    const value = getPath(doc, path)
    const prev = before ? getPath(before, path) : undefined
    if (before && normalizeIndexValue(prev) === normalizeIndexValue(value)) continue
    if (before && prev !== undefined) {
      deletes.push({
        pk: invertedPk(slug, path, prev),
        sk: invertedSk(id),
      })
    }
    if (value !== undefined && value !== null && value !== '') {
      puts.push({
        pk: invertedPk(slug, path, value),
        sk: invertedSk(id),
        entityType: 'idx',
        collection: slug,
        docId: id,
        gsi2pk: invertedGsi2pk(slug, path),
        gsi2sk: invertedSk(id),
      })
    }
  }

  for (const path of pointPaths) {
    const point = parsePoint(getPath(doc, path))
    const prevPoint = before ? parsePoint(getPath(before, path)) : null
    if (before && prevPoint) {
      const prevHash = geohashForPoint(
        {
          longitude: prevPoint.longitude,
          latitude: prevPoint.latitude,
        },
        geoHashKeyLength,
      )
      deletes.push({
        pk: geoPk(slug, path, prevHash.hashPrefix),
        sk: geoSk(id),
      })
    }
    if (point) {
      const { geohash, hashPrefix } = geohashForPoint(
        {
          longitude: point.longitude,
          latitude: point.latitude,
        },
        geoHashKeyLength,
      )
      puts.push({
        pk: geoPk(slug, path, hashPrefix),
        sk: geoSk(id),
        geohash,
        entityType: 'geo',
        collection: slug,
        field: path,
        docId: id,
        gsi2pk: geoGsi2pk(slug, path),
        gsi2sk: geoSk(id),
      })
      mainAttributes[`${path}_geohash`] = geohash
    }
  }

  const search = projectSearchIndex(adapter, collection, doc, before)
  puts.push(...search.puts)
  deletes.push(...search.deletes)

  return { mainAttributes, puts, deletes }
}

export function mainItemKeys(
  adapter: DynamoAdapter,
  collection: CollectionSlug | string,
  id: string,
): IndexKey {
  return {
    pk: collectionPk(adapter.resolvePartition(collection)),
    sk: collectionSk(id),
  }
}

/** Keys for all inverted + geo rows that exist for `doc` (used on delete). */
export function projectCollectionIndexDeletes(
  adapter: DynamoAdapter,
  collection: CollectionSlug | string,
  doc: Record<string, unknown>,
): IndexKey[] {
  const created = projectCollectionIndexes(adapter, collection, doc, null)
  return created.puts.map((row) => ({
    pk: String(row['pk']),
    sk: String(row['sk']),
  }))
}
