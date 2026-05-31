import type { Where } from 'payload'

import { searchNgrams } from '../schema/searchIndex.js'

export type SearchLikePlan = {
  searchText: string
  operator: 'contains' | 'like' | 'not_like'
  fields: string[]
  remainder?: Where
}

const SEARCH_OPS = ['like', 'contains', 'not_like'] as const

function parseSearchLeaf(
  field: string,
  clause: unknown,
  searchable: Set<string>,
  ngramLength: number,
): { field: string; operator: SearchLikePlan['operator']; searchText: string } | null {
  if (!searchable.has(field)) return null
  if (!clause || typeof clause !== 'object' || Array.isArray(clause)) return null

  for (const op of SEARCH_OPS) {
    if (op in clause) {
      const searchText = (clause as Record<string, unknown>)[op]
      if (typeof searchText !== 'string' || searchNgrams(searchText, ngramLength).length === 0) {
        return null
      }
      return { field, operator: op, searchText }
    }
  }
  return null
}

function parseOrGroup(
  clauses: unknown[],
  searchable: Set<string>,
  ngramLength: number,
): Omit<SearchLikePlan, 'remainder'> | null {
  let operator: SearchLikePlan['operator'] | null = null
  let searchText: string | null = null
  const fields: string[] = []

  for (const sub of clauses) {
    if (!sub || typeof sub !== 'object') return null
    const entries = Object.entries(sub).filter(([k]) => k !== 'and' && k !== 'or')
    if (entries.length !== 1) return null
    const [field, raw] = entries[0]!
    const parsed = parseSearchLeaf(field, raw, searchable, ngramLength)
    if (!parsed) return null
    if (operator && operator !== parsed.operator) return null
    if (searchText && searchText !== parsed.searchText) return null
    operator = parsed.operator
    searchText = parsed.searchText
    fields.push(parsed.field)
  }

  if (!operator || !searchText) return null
  return { operator, searchText, fields }
}

export function extractSearchLikeWhere(
  where: Where | undefined,
  searchablePaths: string[],
  ngramLength: number,
): SearchLikePlan | null {
  if (!where || searchablePaths.length === 0) return null
  const searchable = new Set(searchablePaths)

  if ('or' in where && Array.isArray(where.or)) {
    const parsed = parseOrGroup(where.or, searchable, ngramLength)
    if (!parsed) return null
    const remainder = { ...where }
    delete remainder.or
    const rem = Object.keys(remainder).length ? (remainder as Where) : undefined
    return { ...parsed, ...(rem ? { remainder: rem } : {}) }
  }

  const entries = Object.entries(where).filter(([k]) => k !== 'and' && k !== 'or')
  if (entries.length !== 1) return null
  const [field, raw] = entries[0]!
  const parsed = parseSearchLeaf(field, raw, searchable, ngramLength)
  if (!parsed) return null
  return {
    operator: parsed.operator,
    searchText: parsed.searchText,
    fields: [parsed.field],
  }
}
