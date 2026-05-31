import { describe, expect, it } from 'vitest'

import { getPath } from '../../src/utilities/getPath.js'

describe('getPath', () => {
  it('reads dotted paths from records', () => {
    expect(getPath({ a: { b: 1 } }, 'a.b')).toBe(1)
    expect(getPath({ a: 1 }, 'a.b')).toBeUndefined()
    expect(getPath({ a: null }, 'a.b')).toBeUndefined()
  })
})
