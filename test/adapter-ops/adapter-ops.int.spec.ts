import { mkdtemp, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import type { DynamoAdapter } from '../../src/index.js'

import { initPayloadTest, type TestHandle } from '../__helpers/initPayload.js'
import { config } from './config.js'

let handle: TestHandle
let adapter: DynamoAdapter

beforeAll(async () => {
  handle = await initPayloadTest('adapter-ops', config)
  adapter = handle.payload.db as DynamoAdapter
})

afterAll(async () => {
  await handle?.cleanup()
})

beforeEach(async () => {
  for (const slug of ['items', 'drafts-on', 'versioned'] as const) {
    const all = await handle.payload.find({ collection: slug, limit: 0, pagination: false })
    await Promise.all(
      all.docs.map((d) => handle.payload.delete({ collection: slug, id: d.id })),
    )
  }
})

describe('adapter operations — coverage paths', () => {
  it('updateMany with limit and returning:false', async () => {
    await adapter.create({ collection: 'items', data: { title: 'a', score: 1 } })
    await adapter.create({ collection: 'items', data: { title: 'b', score: 2 } })
    await adapter.create({ collection: 'items', data: { title: 'c', score: 3 } })

    const none = await adapter.updateMany({
      collection: 'items',
      where: { score: { greater_than: 1 } },
      data: { score: 9 },
      limit: 1,
      returning: false,
    })
    expect(none).toBeNull()

    const updated = await adapter.updateMany({
      collection: 'items',
      where: { score: { equals: 9 } },
      data: { title: 'nine' },
    })
    expect(updated).toHaveLength(1)
    expect(updated?.[0]?.title).toBe('nine')
  })

  it('updateOne by where and returning:false', async () => {
    const created = await adapter.create({ collection: 'items', data: { title: 'u', score: 1 } })
    const updated = await adapter.updateOne({
      collection: 'items',
      where: { title: { equals: 'u' } },
      data: { score: 9 },
    })
    expect(updated?.score).toBe(9)

    const nulled = await adapter.updateOne({
      collection: 'items',
      id: created.id,
      data: { title: 'gone' },
      returning: false,
    })
    expect(nulled).toBeNull()
  })

  it('updateGlobalVersion by id and where', async () => {
    await handle.payload.updateGlobal({ slug: 'header', data: { logoText: 'v1' } })
    const versions = await adapter.findGlobalVersions({ global: 'header' })
    const versionId = versions.docs.find((v) => v.latest)?.id
    await adapter.updateGlobalVersion({
      global: 'header',
      id: versionId!,
      versionData: { version: { logoText: 'by-id' } },
    })
    await adapter.updateGlobalVersion({
      global: 'header',
      where: { latest: { equals: true } },
      versionData: { version: { logoText: 'by-where' } },
      returning: false,
    })
    const latest = await adapter.findGlobalVersions({
      global: 'header',
      where: { latest: { equals: true } },
    })
    expect(latest.docs[0]?.version?.logoText).toBe('by-where')
  })

  it('deleteOne returning:false on id path', async () => {
    const row = await adapter.create({ collection: 'items', data: { title: 'del' } })
    const out = await adapter.deleteOne({
      collection: 'items',
      where: { id: { equals: row.id } },
      returning: false,
    })
    expect(out).toBeNull()
  })

  it('updateGlobal on missing row returns null', async () => {
    const result = await adapter.updateGlobal({ slug: 'ghost', data: { logoText: 'nope' } })
    expect(result).toBeNull()
  })

  it('deleteOne fast and slow paths', async () => {
    const a = await adapter.create({ collection: 'items', data: { title: 'fast' } })
    const deleted = await adapter.deleteOne({
      collection: 'items',
      where: { id: { equals: a.id } },
    })
    expect(deleted?.title).toBe('fast')

    const b = await adapter.create({ collection: 'items', data: { title: 'slow' } })
    const gone = await adapter.deleteOne({
      collection: 'items',
      where: { title: { equals: 'slow' } },
      returning: false,
    })
    expect(gone).toBeNull()
  })

  it('deleteMany removes all matches', async () => {
    await adapter.create({ collection: 'items', data: { title: 'x' } })
    await adapter.create({ collection: 'items', data: { title: 'x' } })
    const countBefore = await adapter.count({ collection: 'items' })
    expect(countBefore.totalDocs).toBe(2)
    await adapter.deleteMany({ collection: 'items', where: { title: { equals: 'x' } } })
    const countAfter = await adapter.count({ collection: 'items' })
    expect(countAfter.totalDocs).toBe(0)
  })

  it('findOne supplements draft-only docs', async () => {
    const draft = await handle.payload.create({
      collection: 'drafts-on',
      data: { title: 'only-draft', _status: 'draft', priority: 1 },
      draft: true,
    })
    const one = await adapter.findOne({
      collection: 'drafts-on',
      where: { id: { equals: draft.id } },
    })
    expect(one?.title).toBe('only-draft')
  })

  it('queryDrafts and countVersions', async () => {
    await handle.payload.create({
      collection: 'drafts-on',
      data: { title: 'qd', _status: 'published', priority: 1 },
    })
    const drafts = await adapter.queryDrafts({
      collection: 'drafts-on',
      limit: 10,
      where: { title: { equals: 'qd' } },
    })
    expect(drafts.totalDocs).toBeGreaterThan(0)

    const prefixed = await adapter.queryDrafts({
      collection: 'drafts-on',
      limit: 10,
      where: { 'version.title': { equals: 'qd' } },
    })
    expect(prefixed.totalDocs).toBeGreaterThan(0)

    const created = await handle.payload.create({
      collection: 'versioned',
      data: { title: 'v1' },
    })
    await handle.payload.update({
      collection: 'versioned',
      id: created.id,
      data: { title: 'v2' },
    })
    const vc = await adapter.countVersions({
      collection: 'versioned',
      where: { parent: { equals: created.id } },
    })
    expect(vc.totalDocs).toBe(2)
  })

  it('updateVersion, deleteVersions, updateGlobalVersion, countGlobalVersions', async () => {
    const doc = await handle.payload.create({
      collection: 'versioned',
      data: { title: 'orig' },
    })
    const versions = await adapter.findVersions({
      collection: 'versioned',
      where: { parent: { equals: doc.id } },
    })
    const versionId = versions.docs[0]?.id
    expect(versionId).toBeTruthy()

    await adapter.updateVersion({
      collection: 'versioned',
      id: versionId!,
      versionData: { title: 'patched' },
    })

    await adapter.updateVersion({
      collection: 'versioned',
      where: { parent: { equals: doc.id }, latest: { equals: true } },
      versionData: { title: 'via-where' },
      returning: false,
    })

    await adapter.deleteVersions({
      collection: 'versioned',
      where: { parent: { equals: doc.id } },
    })
    const afterDelete = await adapter.countVersions({
      collection: 'versioned',
      where: { parent: { equals: doc.id } },
    })
    expect(afterDelete.totalDocs).toBe(0)

    await handle.payload.updateGlobal({ slug: 'header', data: { logoText: 'g1' } })
    await handle.payload.updateGlobal({ slug: 'header', data: { logoText: 'g2' } })
    const gVersions = await adapter.findGlobalVersions({ global: 'header' })
    expect(gVersions.totalDocs).toBeGreaterThan(0)
    const gvId = gVersions.docs[0]?.id
    await adapter.updateGlobalVersion({
      global: 'header',
      id: gvId!,
      versionData: { logoText: 'g-patched' },
    })
    const gCount = await adapter.countGlobalVersions({
      global: 'header',
      where: {},
    })
    expect(gCount.totalDocs).toBeGreaterThan(0)

    await adapter.deleteVersions({ globalSlug: 'header', where: {} })
    const afterGlobalDelete = await adapter.countGlobalVersions({
      global: 'header',
      where: {},
    })
    expect(afterGlobalDelete.totalDocs).toBe(0)
  })

  it('generateSchema default path, log, and .ts output', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'ddb-schema-'))
    const jsonPath = join(dir, 'schema.json')
    await adapter.generateSchema?.({ outputFile: jsonPath, log: true, prettify: false })
    const compact = await readFile(jsonPath, 'utf-8')
    expect(compact).not.toContain('\n  "')

    const tsPath = join(dir, 'schema.ts')
    await adapter.generateSchema?.({ outputFile: tsPath, log: false, prettify: true })
    const ts = await readFile(tsPath, 'utf-8')
    expect(ts).toContain('payloadGeneratedDynamodb')
  })
})
