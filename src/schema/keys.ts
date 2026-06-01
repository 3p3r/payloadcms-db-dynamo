/**
 * DynamoDB key builders for the single-table layout (aligned with ENTITY_KEY_TEMPLATES).
 */

export function normalizeIndexValue(value: unknown): string {
  if (value === null || value === undefined) return ''
  if (typeof value === 'object' && value !== null && 'id' in value) {
    return String((value as { id: unknown }).id)
  }
  if (typeof value === 'boolean') return value ? '1' : '0'
  return String(value)
}

export function collectionPk(slug: string): string {
  return slug
}

export function collectionSk(id: string): string {
  return String(id)
}

export function invertedPk(slug: string, fieldPath: string, value: unknown): string {
  return `IDX#${slug}#${fieldPath}#${normalizeIndexValue(value)}`
}

export function invertedSk(docId: string): string {
  return String(docId)
}

/** gsi2 hash key for field-scoped reverse index lookups (all values for one indexed field). */
export function invertedGsi2pk(slug: string, fieldPath: string): string {
  return `IDX#${slug}#${fieldPath}`
}

export function searchNgramPk(slug: string, fieldPath: string, gram: string): string {
  return `NGM#${slug}#${fieldPath}#${gram}`
}

export function searchNgramSk(docId: string): string {
  return String(docId)
}

export function listSpineGsi1pk(slug: string): string {
  return `COL#${slug}#LIST`
}

export function listSpineGsi1sk(sortValue: string, docId: string): string {
  return `${sortValue}#DOC#${docId}`
}

export function versionLatestGsi1pk(slug: string): string {
  return `COL#${slug}#VER#LATEST`
}

export function versionParentGsi1pk(slug: string, parentId: string): string {
  return `VER#${slug}#PARENT#${parentId}`
}

export function versionGsi1sk(updatedAt: string, versionId: string): string {
  return `${updatedAt}#VER#${versionId}`
}

export function versionLatestPointerPk(slug: string): string {
  return `COL#${slug}#VER#LATEST`
}

export function versionLatestPointerSk(versionId: string): string {
  return `REF#${versionId}`
}

export function geoPk(slug: string, fieldPath: string, hashPrefix: string | number): string {
  return `GEO#${slug}#${fieldPath}#${hashPrefix}`
}

export function geoSk(docId: string): string {
  return `DOC#${docId}`
}

export function geoGsi2pk(slug: string, fieldPath: string): string {
  return `GEO#${slug}#${fieldPath}`
}

export const GSI1_INDEX_NAME = 'gsi1'
export const GSI2_INDEX_NAME = 'gsi2'
export const GEO_INDEX_NAME = 'geo-index'
