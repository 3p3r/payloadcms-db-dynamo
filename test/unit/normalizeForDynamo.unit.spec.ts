import { describe, expect, it } from 'vitest'

import { normalizeForDynamo } from '../../src/utilities/normalizeForDynamo.js'

describe('normalizeForDynamo', () => {
  it('stringifies dates and recurses through objects and arrays', () => {
    const date = new Date('2020-01-01T00:00:00.000Z')
    expect(normalizeForDynamo(date)).toBe('2020-01-01T00:00:00.000Z')
    expect(normalizeForDynamo({ at: date, tags: [date] })).toEqual({
      at: '2020-01-01T00:00:00.000Z',
      tags: ['2020-01-01T00:00:00.000Z'],
    })
    expect(normalizeForDynamo(null)).toBeNull()
    expect(normalizeForDynamo('plain')).toBe('plain')
  })
})
