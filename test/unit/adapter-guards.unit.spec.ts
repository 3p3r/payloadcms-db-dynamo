import { describe, expect, it } from 'vitest'

import { countGlobalVersions } from '../../src/countGlobalVersions.js'
import { countVersions } from '../../src/countVersions.js'
import { create } from '../../src/create.js'
import { createGlobal } from '../../src/createGlobal.js'
import { createGlobalVersion } from '../../src/createGlobalVersion.js'
import { createVersion } from '../../src/createVersion.js'
import { deleteMany } from '../../src/deleteMany.js'
import { deleteVersions } from '../../src/deleteVersions.js'
import { findGlobal } from '../../src/findGlobal.js'
import { findGlobalVersions } from '../../src/findGlobalVersions.js'
import { findVersions } from '../../src/findVersions.js'
import { migrateFresh } from '../../src/migrateFresh.js'
import { queryDrafts } from '../../src/queryDrafts.js'
import { updateGlobal } from '../../src/updateGlobal.js'
import { updateGlobalVersion } from '../../src/updateGlobalVersion.js'
import { updateMany } from '../../src/updateMany.js'
import { updateOne } from '../../src/updateOne.js'
import { updateVersion } from '../../src/updateVersion.js'
import { upsert } from '../../src/upsert.js'
import { ensureTable } from '../../src/utilities/ensureTable.js'
import { bareAdapter } from '../__helpers/mockAdapter.js'

describe('adapter guard rails', () => {
  const bare = bareAdapter()

  const docClientCases: Array<{ name: string; run: () => Promise<unknown> }> = [
    { name: 'create', run: () => create.call(bare, { collection: 'c', data: {} }) },
    { name: 'upsert', run: () => upsert.call(bare, { collection: 'c', data: {}, where: {} }) },
    {
      name: 'updateOne',
      run: () =>
        updateOne.call(bare, { collection: 'c', id: '1', data: {}, where: { id: { equals: '1' } } }),
    },
    {
      name: 'updateMany',
      run: () => updateMany.call(bare, { collection: 'c', where: {}, data: {} }),
    },
    { name: 'deleteMany', run: () => deleteMany.call(bare, { collection: 'c', where: {} }) },
    {
      name: 'createVersion',
      run: () =>
        createVersion.call(bare, {
          collection: 'c',
          parent: '1',
          versionData: {},
          returning: true,
        } as never),
    },
    {
      name: 'updateVersion',
      run: () => updateVersion.call(bare, { collection: 'c', id: 'v1', versionData: {} } as never),
    },
    { name: 'deleteVersions', run: () => deleteVersions.call(bare, { collection: 'c', where: {} }) },
    { name: 'findVersions', run: () => findVersions.call(bare, { collection: 'c', where: {} }) },
    { name: 'countVersions', run: () => countVersions.call(bare, { collection: 'c', where: {} }) },
    { name: 'queryDrafts', run: () => queryDrafts.call(bare, { collection: 'c', where: {} }) },
    { name: 'findGlobal', run: () => findGlobal.call(bare, { slug: 'g' }) },
    { name: 'createGlobal', run: () => createGlobal.call(bare, { slug: 'g', data: {} }) },
    { name: 'updateGlobal', run: () => updateGlobal.call(bare, { slug: 'g', data: {} }) },
    { name: 'findGlobalVersions', run: () => findGlobalVersions.call(bare, { global: 'g' }) },
    { name: 'countGlobalVersions', run: () => countGlobalVersions.call(bare, { global: 'g', where: {} }) },
    {
      name: 'createGlobalVersion',
      run: () =>
        createGlobalVersion.call(bare, {
          globalSlug: 'g',
          versionData: {},
          returning: true,
        } as never),
    },
    {
      name: 'updateGlobalVersion',
      run: () => updateGlobalVersion.call(bare, { global: 'g', id: 'v', versionData: {} } as never),
    },
  ]

  for (const { name, run } of docClientCases) {
    it(`${name} requires docClient`, async () => {
      await expect(run()).rejects.toThrow(/docClient/)
    })
  }

  it('ensureTable requires a client', async () => {
    await expect(ensureTable(bare, 't')).rejects.toThrow(/client/)
  })

  it('migrateFresh requires a client', async () => {
    await expect(migrateFresh.call(bare, { forceAcceptWarning: true })).rejects.toThrow(/client/)
  })
})
