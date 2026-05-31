import { describe, expect, it, vi } from 'vitest'

import { scrubUnknownFields } from '../../src/index.js'
import { mockAdapter } from '../__helpers/mockAdapter.js'
import { mockSendByPartition } from '../__helpers/mockDynamoSend.js'

function scrubPayload(overrides: {
  collections?: Record<string, unknown>
  globals?: unknown[]
}) {
  const db = mockAdapter({
    send: mockSendByPartition({
      docs: { Items: [{ pk: 'docs', sk: '1', title: 'ok', leak: true }] },
      docs_versions: { Items: [] },
      site: { Items: [] },
      site_versions: { Items: [] },
    }),
  })
  db.payload = {
    collections: overrides.collections ?? {
      docs: {
        config: { fields: [{ name: 'title', type: 'text' }], versions: true },
      },
    },
    config: { globals: overrides.globals ?? [] },
  } as never
  return { db }
}

describe('scrubUnknownFields', () => {
  it('rewrites dirty collection rows and requires a connected adapter', async () => {
    const { db } = scrubPayload({
      globals: [{ slug: 'site', fields: [{ name: 'name', type: 'text' }], versions: true }],
    })
    const report = await scrubUnknownFields({ db } as never)
    expect(report.collections.docs?.scanned).toBe(1)
    expect(report.collections.docs?.modified).toBe(1)
    await expect(scrubUnknownFields({ db: mockAdapter({ docClient: undefined }) } as never)).rejects.toThrow(
      /connected/,
    )
  })

  it('strips array leaks and paginates global version partitions', async () => {
    let versionPages = 0
    const send = mockSendByPartition({
      docs: {
        Items: [{ pk: 'docs', sk: '1', title: 'x', leak: [1, 2] }],
      },
      site_versions: () => {
        versionPages++
        return versionPages === 1
          ? {
              Items: [{ pk: 'site_versions', sk: 'v1', version: { name: 'n' }, extra: true }],
              LastEvaluatedKey: { pk: 'site_versions', sk: 'v1' },
            }
          : { Items: [] }
      },
    })
    const db = mockAdapter({ send })
    db.payload = {
      collections: {
        docs: { config: { fields: [{ name: 'title', type: 'text' }], versions: false } },
      },
      config: {
        globals: [{ slug: 'site', fields: [{ name: 'name', type: 'text' }], versions: true }],
      },
    } as never
    const report = await scrubUnknownFields({ db } as never)
    expect(report.collections.docs?.modified).toBe(1)
    expect(report.globalVersions.site?.scanned).toBe(1)
  })

  it('preserves adapter index attributes when rewriting', async () => {
    const send = mockSendByPartition({
      docs: {
        Items: [
          {
            pk: 'docs',
            sk: '1',
            title: 'ok',
            leak: true,
            gsi1pk: 'COL#docs#LIST',
            gsi1sk: 'x#DOC#1',
          },
        ],
      },
    })
    const db = mockAdapter({ send })
    db.payload = {
      collections: {
        docs: { config: { fields: [{ name: 'title', type: 'text' }] } },
      },
      config: { globals: [] },
    } as never
    const report = await scrubUnknownFields({ db } as never)
    expect(report.collections.docs?.modified).toBe(1)
    const put = send.mock.calls.find((c) => c[0].constructor.name === 'PutCommand')
    expect(put?.[0].input.Item?.gsi1pk).toBe('COL#docs#LIST')
  })

  it('skips idx and geo rows during scan', async () => {
    const send = mockSendByPartition({
      docs: {
        Items: [
          { pk: 'docs', sk: 'idx', entityType: 'idx' },
          { pk: 'docs', sk: 'geo', entityType: 'geo' },
        ],
      },
    })
    const db = mockAdapter({ send })
    db.payload = {
      collections: {
        docs: { config: { fields: [{ name: 'title', type: 'text' }] } },
      },
      config: { globals: [] },
    } as never
    const report = await scrubUnknownFields({ db } as never)
    expect(report.collections.docs?.scanned).toBe(0)
    expect(report.collections.docs?.modified).toBe(0)
  })

  it('preserves geohash adapter attributes', async () => {
    const send = mockSendByPartition({
      docs: {
        Items: [
          {
            pk: 'docs',
            sk: '1',
            title: 'ok',
            leak: true,
            location_geohash: 'abc',
          },
        ],
      },
    })
    const db = mockAdapter({ send })
    db.payload = {
      collections: {
        docs: {
          config: {
            fields: [{ name: 'title', type: 'text' }, { name: 'location', type: 'point' }],
          },
        },
      },
      config: { globals: [] },
    } as never
    await scrubUnknownFields({ db } as never)
    const put = send.mock.calls.find((c) => c[0].constructor.name === 'PutCommand')
    expect(put?.[0].input.Item?.location_geohash).toBe('abc')
  })

  it('no-ops when there are no collections or globals', async () => {
    const db = mockAdapter({ send: vi.fn().mockResolvedValue({ Items: [] }) })
    db.payload = { config: {} } as never
    const report = await scrubUnknownFields({ db } as never)
    expect(report.collections).toEqual({})
    expect(report.globals).toEqual({})
  })
})
