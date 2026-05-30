import { describe, expect, it } from 'vitest'

import { stripVersionPrefix } from '../../src/utilities/stripVersionPrefix.js'

describe('stripVersionPrefix', () => {
  it('strips version. from field keys and nested groups', () => {
    const out = stripVersionPrefix({
      and: [{ 'version.title': { equals: 'a' } }],
      'version.slug': { equals: 'b' },
    })
    expect(out).toEqual({
      and: [{ title: { equals: 'a' } }],
      slug: { equals: 'b' },
    })
  })

  it('returns nullish input unchanged', () => {
    expect(stripVersionPrefix(undefined)).toBeUndefined()
    expect(stripVersionPrefix(null)).toBeNull()
  })
})
