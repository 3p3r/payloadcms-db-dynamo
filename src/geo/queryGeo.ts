import { QueryCommand } from '@aws-sdk/lib-dynamodb'
import type { Where } from 'payload'

import { S2Manager } from 'dynamodb-geo-v3/dist/s2/S2Manager.js'

import {
  coveringForRadius,
  coveringForRectangle,
  DEFAULT_GEO_HASH_KEY_LENGTH,
  geoPartitionForCell,
  toGeoPoint,
} from './geohash.js'
import { parseNearOperator, parsePoint } from './distance.js'
import { GEO_INDEX_NAME } from '../schema/keys.js'
import type { DynamoAdapter, PartialPayloadRequest } from '../types.js'
import { dynamoSend } from '../utilities/dynamoSend.js'
import { extractPolygonRing } from '../utilities/matchOperator.js'

async function queryGeohashRange(
  adapter: DynamoAdapter,
  pk: string,
  rangeMin: string,
  rangeMax: string,
  req?: PartialPayloadRequest,
): Promise<Set<string>> {
  const docIds = new Set<string>()
  let exclusiveStartKey: Record<string, unknown> | undefined

  while (true) {
    const result = await dynamoSend<{
      Items?: Record<string, unknown>[]
      LastEvaluatedKey?: Record<string, unknown>
    }>(
      adapter,
      req,
      new QueryCommand({
        TableName: adapter.tableName,
        IndexName: GEO_INDEX_NAME,
        KeyConditionExpression: '#pk = :pk AND #gh BETWEEN :min AND :max',
        ExpressionAttributeNames: { '#pk': 'pk', '#gh': 'geohash' },
        ExpressionAttributeValues: {
          ':pk': pk,
          ':min': rangeMin,
          ':max': rangeMax,
        },
        ...(exclusiveStartKey ? { ExclusiveStartKey: exclusiveStartKey } : {}),
      }),
    )
    for (const item of result.Items ?? []) {
      const docId = item['docId'] ?? String(item['sk'] ?? '').replace(/^DOC#/, '')
      if (docId) docIds.add(String(docId))
    }
    if (!result.LastEvaluatedKey) break
    exclusiveStartKey = result.LastEvaluatedKey
  }

  return docIds
}

export async function queryGeoDocIds(
  adapter: DynamoAdapter,
  collection: string,
  fieldPath: string,
  operator: 'near' | 'within' | 'intersects',
  clause: unknown,
  req?: PartialPayloadRequest,
): Promise<Set<string> | null> {
  const slug = String(collection)

  if (operator === 'near') {
    const near = parseNearOperator(clause)
    if (!near) return new Set()
    const center = toGeoPoint(near.center.longitude, near.center.latitude)
    const radius = near.maxDistance ?? 1000
    const ranges = coveringForRadius(center, radius)
    const docIds = new Set<string>()
    for (const range of ranges) {
      const splits = range.trySplit(DEFAULT_GEO_HASH_KEY_LENGTH)
      for (const split of splits) {
        const hashPrefix = S2Manager.generateHashKey(
          split.rangeMin,
          DEFAULT_GEO_HASH_KEY_LENGTH,
        ).toString(10)
        const pk = geoPartitionForCell(slug, fieldPath, hashPrefix)
        const ids = await queryGeohashRange(
          adapter,
          pk,
          split.rangeMin.toString(),
          split.rangeMax.toString(),
          req,
        )
        for (const id of ids) docIds.add(id)
      }
    }
    return docIds
  }

  if (operator === 'within' || operator === 'intersects') {
    const raw = clause as { coordinates?: unknown; $geometry?: { coordinates?: unknown } }
    const ring = extractPolygonRing(raw.$geometry?.coordinates ?? raw.coordinates)
    if (!ring || ring.length < 4) return new Set()
    let minLng = ring[0]!.longitude
    let maxLng = ring[0]!.longitude
    let minLat = ring[0]!.latitude
    let maxLat = ring[0]!.latitude
    for (const { longitude: lng, latitude: lat } of ring) {
      minLng = Math.min(minLng, lng)
      maxLng = Math.max(maxLng, lng)
      minLat = Math.min(minLat, lat)
      maxLat = Math.max(maxLat, lat)
    }
    const ranges = coveringForRectangle(
      toGeoPoint(minLng, minLat),
      toGeoPoint(maxLng, maxLat),
    )
    const docIds = new Set<string>()
    for (const range of ranges) {
      const splits = range.trySplit(DEFAULT_GEO_HASH_KEY_LENGTH)
      for (const split of splits) {
        const hashPrefix = S2Manager.generateHashKey(
          split.rangeMin,
          DEFAULT_GEO_HASH_KEY_LENGTH,
        ).toString(10)
        const pk = geoPartitionForCell(slug, fieldPath, hashPrefix)
        const ids = await queryGeohashRange(
          adapter,
          pk,
          split.rangeMin.toString(),
          split.rangeMax.toString(),
          req,
        )
        for (const id of ids) docIds.add(id)
      }
    }
    return docIds
  }

  return null
}

export function extractGeoClause(
  where: Where | undefined,
): { field: string; operator: 'near' | 'within' | 'intersects'; clause: unknown; remainder: Where | undefined } | null {
  if (!where) return null
  for (const [field, raw] of Object.entries(where)) {
    if (field === 'and' || field === 'or') continue
    if (!raw || typeof raw !== 'object') continue
    for (const op of ['near', 'within', 'intersects'] as const) {
      if (op in raw) {
        const remainder = { ...where }
        delete remainder[field]
        const rem = Object.keys(remainder).length ? (remainder as Where) : undefined
        return { field, operator: op, clause: (raw as Record<string, unknown>)[op], remainder: rem }
      }
    }
  }
  return null
}
