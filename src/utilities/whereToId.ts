import type { Where } from 'payload'

/**
 * Detect the "lookup by id equality" fast path. Returns the id when the
 * `where` clause is *exactly* `{ id: { equals: <value> } }` or a single-clause
 * `and` wrapping the same. Returns `null` for anything else — including
 * additional sibling constraints, since DynamoDB `GetItem` cannot enforce them
 * server-side. The caller should fall back to `Scan` + in-memory filtering in
 * that case.
 */
export function whereToId(where: Where | undefined): null | number | string {
  if (!where) {
    return null
  }

  const keys = Object.keys(where)

  if (keys.length === 1 && keys[0] === 'and') {
    const conditions = where.and
    if (Array.isArray(conditions) && conditions.length === 1 && conditions[0]) {
      return whereToId(conditions[0])
    }
    return null
  }

  if (keys.length !== 1 || keys[0] !== 'id') {
    return null
  }

  const clause = where['id']
  if (!clause || typeof clause !== 'object') {
    return null
  }

  const operatorKeys = Object.keys(clause)
  if (operatorKeys.length !== 1 || operatorKeys[0] !== 'equals') {
    return null
  }

  const value = (clause as { equals: unknown }).equals
  if (typeof value === 'string' || typeof value === 'number') {
    return value
  }
  return null
}
