import { describe, expect, it, vi } from 'vitest'

import { findFirst } from '../../src/utilities/findFirst.js'
import { mockAdapter } from '../__helpers/mockAdapter.js'

function adapterWithSend(send: ReturnType<typeof vi.fn>) {
  return mockAdapter({ send, tableName: 't' })
}

describe('findFirst', () => {
  it('uses GetItem for id-equality where', async () => {
    const send = vi.fn().mockResolvedValue({ Item: { pk: 'p', sk: '1', title: 'a' } })
    const row = await findFirst(adapterWithSend(send), {
      partition: 'p',
      where: { id: { equals: '1' } },
    })
    expect(row?.title).toBe('a')
  })

  it('returns null when GetItem misses', async () => {
    const send = vi.fn().mockResolvedValue({})
    const row = await findFirst(adapterWithSend(send), {
      partition: 'p',
      where: { id: { equals: 'missing' } },
    })
    expect(row).toBeNull()
  })

  it('queries partition without filter when where is empty', async () => {
    const send = vi.fn().mockResolvedValue({
      Items: [{ pk: 'p', sk: '1', title: 'first' }],
    })
    const row = await findFirst(adapterWithSend(send), {
      partition: 'p',
      where: {},
    })
    expect(row?.title).toBe('first')
    const cmd = send.mock.calls[0]![0]
    expect(cmd.input.FilterExpression).toBeUndefined()
  })

  it('returns null for always-false filters', async () => {
    const send = vi.fn()
    const row = await findFirst(adapterWithSend(send), {
      partition: 'p',
      where: { id: { in: [] } },
    })
    expect(row).toBeNull()
    expect(send).not.toHaveBeenCalled()
  })

  it('scans in memory for JS-only operators', async () => {
    const send = vi
      .fn()
      .mockResolvedValueOnce({
        Items: [
          { pk: 'p', sk: '1', title: 'nope' },
          { pk: 'p', sk: '2', title: 'match' },
        ],
      })
    const row = await findFirst(adapterWithSend(send), {
      partition: 'p',
      where: { title: { like: 'atch' } },
    })
    expect(row?.title).toBe('match')
  })

  it('paginates Query until a match is found', async () => {
    const send = vi
      .fn()
      .mockResolvedValueOnce({ Items: [], LastEvaluatedKey: { pk: 'p', sk: 'cursor' } })
      .mockResolvedValueOnce({ Items: [{ pk: 'p', sk: '9', title: 'found' }] })
    const row = await findFirst(adapterWithSend(send), {
      partition: 'p',
      where: { title: { equals: 'found' } },
    })
    expect(row?.title).toBe('found')
    expect(send).toHaveBeenCalledTimes(2)
  })

  it('paginates Query until exhausted with no matches', async () => {
    const send = vi
      .fn()
      .mockResolvedValueOnce({ Items: [], LastEvaluatedKey: { pk: 'p', sk: 'c' } })
      .mockResolvedValueOnce({ Items: [] })
    const row = await findFirst(adapterWithSend(send), {
      partition: 'p',
      where: { title: { equals: 'missing' } },
    })
    expect(row).toBeNull()
    expect(send).toHaveBeenCalledTimes(2)
  })

  it('returns null when JS-only filter matches nothing', async () => {
    const send = vi.fn().mockResolvedValue({
      Items: [{ pk: 'p', sk: '1', title: 'nope' }],
    })
    const row = await findFirst(adapterWithSend(send), {
      partition: 'p',
      where: { title: { like: 'yes' } },
    })
    expect(row).toBeNull()
  })

  it('requires docClient', async () => {
    await expect(
      findFirst({ docClient: undefined } as DynamoAdapter, { partition: 'p', where: {} }),
    ).rejects.toThrow(/docClient/)
  })
})
