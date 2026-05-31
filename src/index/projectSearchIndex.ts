import type { CollectionSlug } from 'payload'

import { searchNgramPk, searchNgramSk } from '../schema/keys.js'
import {
  collectSearchIndexPaths,
  normalizeSearchText,
  searchNgrams,
} from '../schema/searchIndex.js'
import type { DynamoAdapter } from '../types.js'
import { getPath } from '../utilities/getPath.js'
import { itemKey } from '../transactions/types.js'
import type { IndexKey, IndexProjection } from './projector.js'

type NgramRow = { path: string; gram: string; key: IndexKey }

function ngramRowsForDoc(
  collection: string,
  docId: string,
  doc: Record<string, unknown>,
  paths: string[],
  ngramLength: number,
): NgramRow[] {
  const rows: NgramRow[] = []
  for (const path of paths) {
    const text = normalizeSearchText(getPath(doc, path))
    for (const gram of searchNgrams(text, ngramLength)) {
      rows.push({
        path,
        gram,
        key: {
          pk: searchNgramPk(collection, path, gram),
          sk: searchNgramSk(docId),
        },
      })
    }
  }
  return rows
}

export function projectSearchIndex(
  adapter: DynamoAdapter,
  collection: CollectionSlug | string,
  doc: Record<string, unknown>,
  before: Record<string, unknown> | null,
): Pick<IndexProjection, 'puts' | 'deletes'> {
  const slug = String(collection)
  const config = adapter.payload?.collections?.[slug]?.config
  if (!config) return { puts: [], deletes: [] }

  const paths = collectSearchIndexPaths(config)
  if (paths.length === 0) return { puts: [], deletes: [] }

  const id = String(doc['id'])
  const ngramLength = adapter.config.searchNgramLength
  const afterRows = ngramRowsForDoc(slug, id, doc, paths, ngramLength)
  const afterKeys = new Set(afterRows.map((row) => itemKey(row.key.pk, row.key.sk)))
  const deletes: IndexKey[] = []

  if (before) {
    for (const row of ngramRowsForDoc(slug, id, before, paths, ngramLength)) {
      const key = itemKey(row.key.pk, row.key.sk)
      if (!afterKeys.has(key)) {
        deletes.push(row.key)
      }
    }
  }

  const puts = afterRows.map((row) => ({
    pk: row.key.pk,
    sk: row.key.sk,
    entityType: 'ngm',
    collection: slug,
    field: row.path,
    docId: id,
    gram: row.gram,
  }))

  return { puts, deletes }
}
