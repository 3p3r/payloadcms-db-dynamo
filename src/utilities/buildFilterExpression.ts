import type { Where } from 'payload'

import { normalizeForDynamo } from './normalizeForDynamo.js'
import {
  FILTER_NON_PUSHABLE_OPERATORS,
  SUPPORTED_OPERATORS,
  unsupportedOperatorError,
} from './operators.js'

/**
 * Compile a Payload `Where` into a DynamoDB `FilterExpression` plus its
 * companion `ExpressionAttributeNames` / `ExpressionAttributeValues` maps.
 *
 * Return contract:
 *  - `undefined` — no filter to apply (empty/missing `where`, or only no-op
 *    clauses like `and: []`). Callers should query without a filter.
 *  - `null` — the predicate is structurally always-false (e.g. an empty
 *    `id: { in: [] }`). Callers should short-circuit and return zero rows
 *    without ever hitting DynamoDB. Payload uses empty `in` as a "match
 *    nothing" sentinel (typically from access control resolving to no IDs);
 *    surfacing it as a filter would mean throwing or constructing an
 *    invalid `IN ()` clause.
 *  - `FilterExpression` — actual predicate to push down.
 *
 * Throws on any operator outside `operators.ts`'s supported set, identical
 * to `matchesWhere` — coverage is enforced from one source so the in-JS
 * path and the pushdown path can never disagree.
 *
 * Implementation notes:
 *  - Every field path segment becomes an `#nN` placeholder, sidestepping
 *    DynamoDB's reserved-word list entirely. Segments are deduped per-call so
 *    repeated fields produce one `#name` entry rather than many.
 *  - Every value becomes a `:vN` placeholder. We don't dedupe values because
 *    array members and repeated literals are cheap and the placeholder count
 *    keeps the expression readable.
 *  - Dotted paths in `where` keys are split on `.` so DynamoDB document-path
 *    syntax (`#a.#b`) is produced for nested fields.
 *  - `in: []` propagates a NEVER sentinel through the AND/OR algebra:
 *    AND with NEVER → NEVER (whole result `null`); OR with NEVER drops the
 *    NEVER branch; an OR whose every branch is NEVER itself becomes NEVER.
 *  - `not_in: []` is treated as no constraint (the complement of an empty
 *    set is everything, so omitting it from the expression matches semantics).
 */
export type FilterExpression = {
  expression: string
  names: Record<string, string>
  values: Record<string, unknown>
}

const NEVER = Symbol('payload-ddb-filter-never')
type Compiled = string | typeof NEVER

type Ctx = {
  nameByPlaceholder: Record<string, string>
  nameCounter: number
  placeholderBySegment: Map<string, string>
  valueCounter: number
  values: Record<string, unknown>
}

export function buildFilterExpression(
  where: undefined | Where,
): FilterExpression | null | undefined {
  if (!where) return undefined

  const ctx: Ctx = {
    nameByPlaceholder: {},
    nameCounter: 0,
    placeholderBySegment: new Map(),
    valueCounter: 0,
    values: {},
  }

  const expression = compile(where, ctx)
  if (expression === NEVER) return null
  if (!expression) return undefined

  return {
    expression,
    names: ctx.nameByPlaceholder,
    values: ctx.values,
  }
}

function compile(where: Where, ctx: Ctx): Compiled {
  const parts: string[] = []

  for (const [key, raw] of Object.entries(where)) {
    if (key === 'and') {
      const inner = compileGroup(raw, ctx, 'AND')
      if (inner === NEVER) return NEVER
      if (inner) parts.push(inner)
      continue
    }
    if (key === 'or') {
      const inner = compileGroup(raw, ctx, 'OR')
      if (inner === NEVER) return NEVER
      if (inner) parts.push(inner)
      continue
    }

    if (!raw || typeof raw !== 'object') continue

    const path = pathRef(ctx, key)
    const operators = raw as Record<string, unknown>

    for (const [operator, expected] of Object.entries(operators)) {
      if (!SUPPORTED_OPERATORS.has(operator)) {
        throw unsupportedOperatorError(operator, key)
      }
      const expr = operatorToExpression(operator, path, expected, ctx)
      if (expr === NEVER) return NEVER
      if (expr) parts.push(expr)
    }
  }

  if (parts.length === 0) return ''
  if (parts.length === 1) return parts[0]!
  return parts.join(' AND ')
}

function compileGroup(raw: unknown, ctx: Ctx, joiner: 'AND' | 'OR'): Compiled {
  if (!Array.isArray(raw)) return ''
  const subs: string[] = []
  let neverCount = 0
  let consideredCount = 0
  for (const sub of raw) {
    if (!sub || typeof sub !== 'object') continue
    consideredCount++
    const expr = compile(sub as Where, ctx)
    if (expr === NEVER) {
      if (joiner === 'AND') return NEVER
      neverCount++
      continue
    }
    if (expr) subs.push(expr)
  }
  // OR over branches that all collapsed to NEVER is NEVER itself.
  if (joiner === 'OR' && consideredCount > 0 && neverCount === consideredCount) {
    return NEVER
  }
  if (subs.length === 0) return ''
  if (subs.length === 1) return subs[0]!
  return `(${subs.join(` ${joiner} `)})`
}

function pathRef(ctx: Ctx, path: string): string {
  return path
    .split('.')
    .map((segment) => segmentRef(ctx, segment))
    .join('.')
}

function segmentRef(ctx: Ctx, segment: string): string {
  const cached = ctx.placeholderBySegment.get(segment)
  if (cached) return cached
  const placeholder = `#n${ctx.nameCounter++}`
  ctx.nameByPlaceholder[placeholder] = segment
  ctx.placeholderBySegment.set(segment, placeholder)
  return placeholder
}

function valueRef(ctx: Ctx, value: unknown): string {
  const placeholder = `:v${ctx.valueCounter++}`
  // Normalize so Date literals in `where` compare against the ISO strings we
  // actually stored. Without this, `{ updatedAt: { greater_than: new Date() } }`
  // would push an empty map literal into the filter and DynamoDB would reject
  // the comparison.
  ctx.values[placeholder] = normalizeForDynamo(value)
  return placeholder
}

const DYNAMO_COMPARE_OPS: Record<
  string,
  (path: string, expected: unknown, ctx: Ctx) => Compiled
> = {
  equals: (path, expected, ctx) => `${path} = ${valueRef(ctx, expected)}`,
  exists: (path, expected) =>
    expected ? `attribute_exists(${path})` : `attribute_not_exists(${path})`,
  greater_than: (path, expected, ctx) => `${path} > ${valueRef(ctx, expected)}`,
  greater_than_equal: (path, expected, ctx) => `${path} >= ${valueRef(ctx, expected)}`,
  in: (path, expected, ctx) => {
    if (!Array.isArray(expected)) return ''
    if (expected.length === 0) return NEVER
    const refs = expected.map((v) => valueRef(ctx, v))
    return `${path} IN (${refs.join(', ')})`
  },
  less_than: (path, expected, ctx) => `${path} < ${valueRef(ctx, expected)}`,
  less_than_equal: (path, expected, ctx) => `${path} <= ${valueRef(ctx, expected)}`,
  not_equals: (path, expected, ctx) => `${path} <> ${valueRef(ctx, expected)}`,
  not_in: (path, expected, ctx) => {
    if (!Array.isArray(expected) || expected.length === 0) return ''
    const refs = expected.map((v) => valueRef(ctx, v))
    return `NOT (${path} IN (${refs.join(', ')}))`
  },
}

function operatorToExpression(
  operator: string,
  path: string,
  expected: unknown,
  ctx: Ctx,
): Compiled {
  if (FILTER_NON_PUSHABLE_OPERATORS.has(operator)) return ''
  return DYNAMO_COMPARE_OPS[operator]!(path, expected, ctx)
}
