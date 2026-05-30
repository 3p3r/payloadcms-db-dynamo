import { describe, expect, it, vi } from 'vitest'

import { create } from '../../src/create.js'
import { createGlobalVersion } from '../../src/createGlobalVersion.js'
import { createVersion } from '../../src/createVersion.js'
import { upsert } from '../../src/upsert.js'
import { updateGlobalVersion } from '../../src/updateGlobalVersion.js'
import { updateOne } from '../../src/updateOne.js'
import { updateVersion } from '../../src/updateVersion.js'
import * as findFirstModule from '../../src/utilities/findFirst.js'
import { writeAdapter } from '../__helpers/mockAdapter.js'

describe('adapter write paths', () => {
  it('create and upsert honor returning:false', async () => {
    const adapter = writeAdapter()
    expect(
      await create.call(adapter, { collection: 'posts', data: { title: 'x' }, returning: false }),
    ).toBeNull()
    vi.spyOn(findFirstModule, 'findFirst').mockResolvedValue(null)
    expect(
      await upsert.call(adapter, {
        collection: 'posts',
        data: { title: 'y' },
        where: { title: { equals: 'y' } },
        returning: false,
      }),
    ).toBeNull()
    vi.restoreAllMocks()
  })

  it('updateOne and updateVersion merge by id or where', async () => {
    const send = vi
      .fn()
      .mockResolvedValueOnce({ Item: { pk: 'posts', sk: '1', id: '1', title: 'old' } })
      .mockResolvedValue({})
    const adapter = writeAdapter(send)
    expect(
      (await updateOne.call(adapter, { collection: 'posts', id: '1', data: { title: 'new' } }))?.title,
    ).toBe('new')

    vi.spyOn(findFirstModule, 'findFirst').mockResolvedValue({
      id: 'v1',
      parent: '1',
      version: { title: 'v' },
    })
    expect(
      await updateVersion.call(adapter, {
        collection: 'posts',
        where: { latest: { equals: true } },
        versionData: { version: { title: 'patched' } },
        returning: false,
      }),
    ).toBeNull()
    vi.restoreAllMocks()
  })

  it('updateOne returns null when no row matches', async () => {
    vi.spyOn(findFirstModule, 'findFirst').mockResolvedValue(null)
    expect(
      await updateOne.call(writeAdapter(), {
        collection: 'posts',
        where: { title: { equals: 'missing' } },
        data: { title: 'x' },
      }),
    ).toBeNull()
    vi.restoreAllMocks()
  })

  it('createGlobalVersion flips latest; updateGlobalVersion patches by where', async () => {
    vi.spyOn(findFirstModule, 'findFirst').mockImplementation(async (_adapter, args) => {
      if (args.where?.latest) {
        return { id: 'gv1', version: { logoText: 'old' }, latest: true }
      }
      return { id: 'prev', latest: true }
    })
    const send = vi.fn().mockResolvedValue({})
    const adapter = writeAdapter(send)

    const created = await createGlobalVersion.call(adapter, {
      globalSlug: 'header',
      versionData: { logoText: 'v2' },
      createdAt: 't',
      updatedAt: 't',
      snapshot: true,
      publishedLocale: 'en',
    } as never)
    expect(created?.latest).toBe(true)
    expect(created?.snapshot).toBe(true)
    expect(
      await createGlobalVersion.call(adapter, {
        globalSlug: 'header',
        versionData: { logoText: 'v3' },
        createdAt: 't',
        updatedAt: 't',
        returning: false,
      } as never),
    ).toBeNull()

    const updated = await updateGlobalVersion.call(adapter, {
      global: 'header',
      where: { latest: { equals: true } },
      versionData: { version: { logoText: 'new' } },
    } as never)
    expect((updated as { version?: { logoText?: string } })?.version?.logoText).toBe('new')
    vi.restoreAllMocks()
  })

  it('createVersion returns null when returning is false', async () => {
    vi.spyOn(findFirstModule, 'findFirst').mockResolvedValue(null)
    expect(
      await createVersion.call(writeAdapter(vi.fn().mockResolvedValue({})), {
        collection: 'posts',
        parent: 'p1',
        versionData: { title: 'v' },
        createdAt: 't',
        updatedAt: 't',
        returning: false,
      } as never),
    ).toBeNull()
    vi.restoreAllMocks()
  })
})
