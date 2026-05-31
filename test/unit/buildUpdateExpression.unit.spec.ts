import { describe, expect, it } from 'vitest'

import { buildUpdateExpression } from '../../src/utilities/buildUpdateExpression.js'

describe('buildUpdateExpression', () => {
  it('builds SET for flat and nested patches', () => {
    const parts = buildUpdateExpression({
      title: 'x',
      meta: { author: 'a' },
      updatedAt: 'now',
    })
    expect(parts?.UpdateExpression).toMatch(/^SET /)
    expect(parts?.ExpressionAttributeNames).toBeTruthy()
    expect(parts?.ExpressionAttributeValues?.[':v0']).toBe('x')
  })

  it('returns null for empty patch', () => {
    expect(buildUpdateExpression({})).toBeNull()
  })
})
