import { describe, expect, it, vi } from 'vitest'

import { deleteOne } from '../../src/deleteOne.js'
import { findGlobal } from '../../src/findGlobal.js'
import { findOne } from '../../src/findOne.js'
import * as draftsFallbackModule from '../../src/utilities/draftsFallback.js'
import * as findFirstModule from '../../src/utilities/findFirst.js'
import { mockAdapter } from '../__helpers/mockAdapter.js'

describe('adapter CRUD edge paths', () => {
  it('deleteOne: fast path, slow path, returning:false, and docClient guard', async () => {
    await expect(
      deleteOne.call(mockAdapter({ docClient: undefined }), {
        collection: 'c',
        where: { id: { equals: '1' } },
      }),
    ).rejects.toThrow(/docClient/)

    const send = vi
      .fn()
      .mockResolvedValueOnce({ Attributes: { pk: 'c', sk: '1', title: 'gone' } })
      .mockResolvedValueOnce({})
    const adapter = mockAdapter({ send })

    expect(
      (
        await deleteOne.call(adapter, {
          collection: 'c',
          where: { id: { equals: '1' } },
          req: { transactionID: 'noop' } as never,
        })
      )?.title,
    ).toBe('gone')

    expect(
      await deleteOne.call(adapter, {
        collection: 'c',
        where: { id: { equals: 'missing' } },
        returning: false,
      }),
    ).toBeNull()

    vi.spyOn(findFirstModule, 'findFirst').mockResolvedValue({ id: '2', title: 'slow' })
    expect(
      (await deleteOne.call(adapter, { collection: 'c', where: { title: { equals: 'slow' } } }))?.title,
    ).toBe('slow')

    vi.mocked(findFirstModule.findFirst).mockResolvedValue(null)
    expect(
      await deleteOne.call(adapter, { collection: 'c', where: { title: { equals: 'nope' } } }),
    ).toBeNull()
    vi.restoreAllMocks()
  })

  it('findOne supplements draft-only rows when the main partition is empty', async () => {
    vi.spyOn(findFirstModule, 'findFirst').mockResolvedValue(null)
    vi.spyOn(draftsFallbackModule, 'collectionHasDrafts').mockReturnValue(true)
    vi.spyOn(draftsFallbackModule, 'fetchDraftsOnlySupplements').mockResolvedValue([
      { id: 'd1', title: 'draft-only' },
    ])
    const row = await findOne.call(mockAdapter(), {
      collection: 'drafts-on',
      where: { title: { equals: 'draft-only' } },
    })
    expect(row?.title).toBe('draft-only')
    vi.restoreAllMocks()
  })

  it('findGlobal applies optional where as a post-filter', async () => {
    const send = vi.fn().mockResolvedValue({
      Item: { pk: 'site', sk: 'site', siteName: 'ok' },
    })
    const adapter = mockAdapter({ send })
    expect(
      (await findGlobal.call(adapter, { slug: 'site', where: { siteName: { equals: 'ok' } } }))?.siteName,
    ).toBe('ok')
    expect(
      await findGlobal.call(adapter, { slug: 'site', where: { siteName: { equals: 'nope' } } }),
    ).toBeNull()
  })
})
