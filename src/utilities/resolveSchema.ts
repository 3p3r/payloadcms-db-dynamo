import type { Field } from 'payload'

import { adapterError } from '../packageMeta.js'
import type { DynamoAdapter } from '../types.js'

import { pickConfiguredFields, pickConfiguredVersionRow } from './pickConfiguredFields.js'

export function getCollectionFields(adapter: DynamoAdapter, slug: string): Field[] | null {
  const config = adapter.payload?.collections?.[slug]?.config
  return config?.fields ?? null
}

export function getGlobalFields(adapter: DynamoAdapter, slug: string): Field[] | null {
  const globals = adapter.payload?.config?.globals
  if (!Array.isArray(globals)) return null
  const config = globals.find((g: { slug: string }) => g.slug === slug)
  return config?.fields ?? null
}

/**
 * Reserved keys Payload's framework layer owns rather than declaring through
 * `fields`. Allowed at the top of every collection/global row.
 *
 *  - `id`                    — primary key
 *  - `createdAt`/`updatedAt` — timestamp pair (default-on per collection config)
 *  - `_status`               — drafts state (only present when drafts enabled,
 *                              but allow-listing it unconditionally is harmless)
 *  - `globalType`            — Payload tags global rows with this internally
 */
export const ROW_RESERVED_KEYS = ['id', 'createdAt', 'updatedAt', '_status', 'globalType'] as const

/**
 * Reserved keys at the top of a *version* row. The inner `version` field
 * holds the actual doc snapshot and is recursed into separately against the
 * parent collection/global's own fields.
 */
export const VERSION_ROW_RESERVED_KEYS = [
  'id',
  'parent',
  'version',
  'createdAt',
  'updatedAt',
  'latest',
  'autosave',
  'snapshot',
  'publishedLocale',
] as const

export function projectForCollection(
  adapter: DynamoAdapter,
  slug: string,
  data: Record<string, unknown>,
): Record<string, unknown> {
  const fields = getCollectionFields(adapter, slug)
  if (!fields) {
    throw adapterError(`unknown collection \`${slug}\``)
  }
  return pickConfiguredFields(data, fields, ROW_RESERVED_KEYS)
}

export function projectForGlobal(
  adapter: DynamoAdapter,
  slug: string,
  data: Record<string, unknown>,
): Record<string, unknown> {
  const fields = getGlobalFields(adapter, slug)
  if (!fields) {
    throw adapterError(`unknown global \`${slug}\``)
  }
  return pickConfiguredFields(data, fields, ROW_RESERVED_KEYS)
}

/**
 * Strip the inner doc snapshot of a version's `versionData` argument against
 * the parent collection or global's fields. The createVersion adapters wrap
 * the result into a version row whose other keys (parent, latest, ...) are
 * set explicitly by the adapter, so we only need to project the snapshot.
 */
export function projectVersionSnapshot(
  adapter: DynamoAdapter,
  parent: { kind: 'collection' | 'global'; slug: string },
  data: Record<string, unknown>,
): Record<string, unknown> {
  const fields =
    parent.kind === 'collection'
      ? getCollectionFields(adapter, parent.slug)
      : getGlobalFields(adapter, parent.slug)
  if (!fields) {
    throw adapterError(`unknown ${parent.kind} \`${parent.slug}\``)
  }
  return pickConfiguredFields(data, fields, ROW_RESERVED_KEYS)
}

export function projectVersionRow(
  adapter: DynamoAdapter,
  parent: { kind: 'collection' | 'global'; slug: string },
  row: Record<string, unknown>,
): Record<string, unknown> {
  const fields =
    parent.kind === 'collection'
      ? getCollectionFields(adapter, parent.slug)
      : getGlobalFields(adapter, parent.slug)
  if (!fields) {
    throw adapterError(`unknown ${parent.kind} \`${parent.slug}\``)
  }
  return pickConfiguredVersionRow(row, fields)
}
