import { describe, expect, it } from 'vitest'

import { getPath } from '../../src/utilities/getPath.js'

describe('utilities', () => {
  it('getPath reads nested paths', () => {
    expect(getPath({ a: { b: 1 } }, 'a.b')).toBe(1)
    expect(getPath({ a: 1 }, 'a.c')).toBeUndefined()
    expect(getPath({ a: 1 }, 'a.b.c')).toBeUndefined()
    expect(getPath(null, 'a')).toBeUndefined()
  })
})
