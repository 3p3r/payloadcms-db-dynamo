import { GetCommand, PutCommand } from '@aws-sdk/lib-dynamodb'
import { describe, expect, it, vi } from 'vitest'

import { writeDocument } from '../../src/utilities/writeDocument.js'
import { writeAdapter } from '../__helpers/mockAdapter.js'

describe('writeDocument', () => {
  it('merges data, preserves id, and writes Put with conditional updatedAt', async () => {
    const send = vi.fn().mockResolvedValue({})
    const adapter = writeAdapter(send)

    const result = await writeDocument(adapter, {
      collection: 'posts',
      target: { id: '1', title: 'old', updatedAt: 't1' },
      data: { title: 'new' },
    })

    expect(result?.title).toBe('new')
    expect(result?.id).toBe('1')
    expect(result?.updatedAt).toBeTruthy()

    const put = send.mock.calls.find(([cmd]) => cmd instanceof PutCommand)?.[0] as
      | PutCommand
      | undefined
    expect(put?.input.ConditionExpression).toContain('updatedAt')
    expect(put?.input.ExpressionAttributeValues?.[':expectedUpdatedAt']).toBe('t1')
    expect(send.mock.calls.some(([cmd]) => cmd instanceof GetCommand)).toBe(false)
  })

  it('returns null when returning is false', async () => {
    const adapter = writeAdapter(vi.fn().mockResolvedValue({}))
    expect(
      await writeDocument(adapter, {
        collection: 'posts',
        target: { id: '1', title: 'old' },
        data: { title: 'new' },
        returning: false,
      }),
    ).toBeNull()
  })
})
