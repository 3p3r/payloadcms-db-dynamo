import { GetCommand } from '@aws-sdk/lib-dynamodb'
import { describe, expect, it, vi } from 'vitest'

import { updateMany } from '../../src/updateMany.js'
import * as queryMatchingModule from '../../src/utilities/queryMatching.js'
import { writeAdapter } from '../__helpers/mockAdapter.js'

describe('updateMany', () => {
  it('does not issue GetCommand when targets come from queryMatching', async () => {
    const send = vi.fn().mockResolvedValue({})
    const adapter = writeAdapter(send)

    vi.spyOn(queryMatchingModule, 'queryMatching').mockResolvedValue([
      { id: '1', title: 'a', updatedAt: 't1' },
      { id: '2', title: 'b', updatedAt: 't2' },
    ])

    const updated = await updateMany.call(adapter, {
      collection: 'posts',
      where: {},
      data: { title: 'patched' },
    })

    expect(updated).toHaveLength(2)
    expect(updated?.[0]?.title).toBe('patched')
    expect(send.mock.calls.some(([cmd]) => cmd instanceof GetCommand)).toBe(false)
    vi.restoreAllMocks()
  })

  it('returns empty array when no matches and returning is true', async () => {
    const adapter = writeAdapter()
    vi.spyOn(queryMatchingModule, 'queryMatching').mockResolvedValue([])

    const updated = await updateMany.call(adapter, {
      collection: 'posts',
      where: { title: { equals: 'missing' } },
      data: { title: 'x' },
    })

    expect(updated).toEqual([])
    vi.restoreAllMocks()
  })

  it('returns null when no matches and returning is false', async () => {
    const adapter = writeAdapter()
    vi.spyOn(queryMatchingModule, 'queryMatching').mockResolvedValue([])

    const result = await updateMany.call(adapter, {
      collection: 'posts',
      where: {},
      data: { title: 'x' },
      returning: false,
    })

    expect(result).toBeNull()
    vi.restoreAllMocks()
  })
})
