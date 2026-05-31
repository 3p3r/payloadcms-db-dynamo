import type { Where } from 'payload'

import { getPath } from './getPath.js'
import { matchOperator } from './matchOperator.js'
import { SUPPORTED_OPERATORS, unsupportedOperatorError } from './operators.js'

/**
 * In-memory predicate that evaluates a Payload `Where` against a fetched item.
 */
export function matchesWhere(item: Record<string, unknown>, where: Where | undefined): boolean {
  if (!where) return true

  for (const [key, raw] of Object.entries(where)) {
    if (key === 'and') {
      if (Array.isArray(raw) && !raw.every((sub) => matchesWhere(item, sub as Where))) {
        return false
      }
      continue
    }

    if (key === 'or') {
      if (Array.isArray(raw) && !raw.some((sub) => matchesWhere(item, sub as Where))) {
        return false
      }
      continue
    }

    if (!raw || typeof raw !== 'object') continue

    const fieldValue = getPath(item, key)
    for (const [operator, expected] of Object.entries(raw as Record<string, unknown>)) {
      if (!SUPPORTED_OPERATORS.has(operator)) {
        throw unsupportedOperatorError(operator, key)
      }
      if (!matchOperator(fieldValue, operator, expected)) {
        return false
      }
    }
  }

  return true
}
