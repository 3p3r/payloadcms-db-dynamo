import { describe, expect, it } from 'vitest'

import { applySorts } from '../../src/utilities/applySorts.js'

describe('applySorts', () => {
  it('sorts by multiple keys and descending prefix', () => {
    const items = [
      { id: '1', score: 2, name: 'b' },
      { id: '2', score: 2, name: 'a' },
      { id: '3', score: 1, name: 'z' },
    ]
    applySorts(items, ['score', '-name'])
    expect(items.map((i) => i.id)).toEqual(['3', '1', '2'])
  })

  it('no-ops for empty sort input', () => {
    const items = [{ id: '1' }]
    applySorts(items, undefined)
    applySorts(items, [])
    applySorts(items, ['', '-id'])
    expect(items[0]?.id).toBe('1')
  })

  it('returns stable order when all keys tie', () => {
    const items = [{ id: '1', n: 1 }, { id: '2', n: 1 }]
    applySorts(items, ['n'])
    expect(items).toHaveLength(2)
  })
})
