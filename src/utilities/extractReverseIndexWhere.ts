import type { Where } from 'payload'

export type ReverseIndexPlan = {
  field: string
  mode: 'exists' | 'not_equals' | 'not_in'
  excludeValue?: unknown
  excludeValues?: unknown[]
  remainder?: Where
}

export function extractReverseIndexWhere(
  where: Where | undefined,
  indexPaths: string[],
): ReverseIndexPlan | null {
  if (!where || indexPaths.length === 0) return null

  for (const field of indexPaths) {
    const clause = where[field]
    if (!clause || typeof clause !== 'object' || Array.isArray(clause)) continue

    const record = clause as Record<string, unknown>
    const remainder = { ...where }
    delete remainder[field]
    const rem = Object.keys(remainder).length ? (remainder as Where) : undefined

    if ('exists' in record && record['exists'] === true) {
      return { field, mode: 'exists', ...(rem ? { remainder: rem } : {}) }
    }

    if ('not_equals' in record && record['not_equals'] !== undefined) {
      return {
        field,
        mode: 'not_equals',
        excludeValue: record['not_equals'],
        ...(rem ? { remainder: rem } : {}),
      }
    }

    if ('not_in' in record && Array.isArray(record['not_in']) && record['not_in'].length > 0) {
      return {
        field,
        mode: 'not_in',
        excludeValues: record['not_in'],
        ...(rem ? { remainder: rem } : {}),
      }
    }
  }

  return null
}
