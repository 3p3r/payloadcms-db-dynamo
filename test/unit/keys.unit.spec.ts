import { describe, expect, it } from 'vitest'

import {
  geoPk,
  geoSk,
  invertedPk,
  listSpineGsi1pk,
  listSpineGsi1sk,
  normalizeIndexValue,
} from '../../src/schema/keys.js'

describe('schema/keys', () => {
  it('normalizes index values', () => {
    expect(normalizeIndexValue({ id: 'x' })).toBe('x')
    expect(normalizeIndexValue(true)).toBe('1')
    expect(normalizeIndexValue(false)).toBe('0')
    expect(normalizeIndexValue(null)).toBe('')
    expect(normalizeIndexValue(undefined)).toBe('')
    expect(normalizeIndexValue('a')).toBe('a')
  })

  it('builds inverted and list spine keys', () => {
    expect(invertedPk('items', 'email', 'a@b.c')).toBe('IDX#items#email#a@b.c')
    expect(listSpineGsi1pk('items')).toBe('COL#items#LIST')
    expect(listSpineGsi1sk('2024', 'id1')).toBe('2024#DOC#id1')
    expect(geoPk('places', 'loc', 12)).toBe('GEO#places#loc#12')
    expect(geoSk('id1')).toBe('DOC#id1')
  })
})
