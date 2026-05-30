import { describe, expect, it } from 'vitest'

import { buildFilterExpression } from '../../src/utilities/buildFilterExpression.js'
import { unsupportedOperatorError } from '../../src/utilities/operators.js'

describe('buildFilterExpression', () => {
  it('returns undefined for empty where', () => {
    expect(buildFilterExpression(undefined)).toBeUndefined()
    expect(buildFilterExpression({ and: [] })).toBeUndefined()
  })

  it('returns null for always-false predicates', () => {
    expect(buildFilterExpression({ id: { in: [] } })).toBeNull()
    expect(buildFilterExpression({ or: [{ id: { in: [] } }] })).toBeNull()
  })

  it('compiles comparisons and nested paths', () => {
    const f = buildFilterExpression({
      'meta.code': { equals: 'x' },
      count: { greater_than: 1 },
      tag: { exists: true },
    })
    expect(f?.expression).toContain('#n')
    expect(f?.values).toBeDefined()
  })

  it('compiles and / or groups', () => {
    const andExpr = buildFilterExpression({
      and: [{ title: { equals: 'a' } }, { title: { equals: 'b' } }],
    })
    expect(andExpr?.expression).toContain('AND')

    const orExpr = buildFilterExpression({
      or: [{ title: { equals: 'a' } }, { title: { equals: 'b' } }],
    })
    expect(orExpr?.expression).toContain('OR')
  })

  it('treats empty not_in as no constraint', () => {
    const f = buildFilterExpression({ id: { not_in: [] } })
    expect(f).toBeUndefined()
  })

  it('throws on unsupported operators', () => {
    expect(() =>
      buildFilterExpression({ title: { bogus: true } as never }),
    ).toThrow(unsupportedOperatorError('bogus', 'title').message)
  })

  it('treats invalid in operands as no constraint', () => {
    expect(buildFilterExpression({ count: { in: 'nope' as never } })).toBeUndefined()
  })

  it('omits JS-only operators from the compiled filter', () => {
    expect(buildFilterExpression({ title: { like: 'x' } })).toBeUndefined()
    expect(buildFilterExpression({ title: { near: [1, 2, 3] } })).toBeUndefined()
  })

  it('treats OR of impossible branches as always-false', () => {
    expect(
      buildFilterExpression({
        or: [{ id: { in: [] } }, { id: { in: [] } }],
      }),
    ).toBeNull()
  })

  it('propagates NEVER through AND and skips non-object clauses', () => {
    expect(buildFilterExpression({ and: [{ id: { in: [] } }] })).toBeNull()
    expect(buildFilterExpression({ broken: null as never, title: { equals: 'a' } })).toBeDefined()
  })
})
