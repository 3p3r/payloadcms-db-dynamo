import { describe, expect, it } from 'vitest'

import {
  pickConfiguredFields,
  pickConfiguredVersionRow,
} from '../../src/utilities/pickConfiguredFields.js'

describe('pickConfiguredFields', () => {
  it('drops unknown keys in groups and arrays', () => {
    const fields = [
      { name: 'title', type: 'text' },
      { name: 'tags', type: 'array', fields: [{ name: 'label', type: 'text' }] },
    ] as never
    const out = pickConfiguredFields(
      { title: 'ok', tags: [{ label: 'a', leak: 1 }], leak: 2 },
      fields,
    )
    expect(out.title).toBe('ok')
    expect((out.tags as { label: string }[])[0]?.label).toBe('a')
    expect(out.leak).toBeUndefined()
  })

  it('recurses into groups, arrays, blocks, and tabs', () => {
    const fields = [
      {
        name: 'hero',
        type: 'group',
        fields: [{ name: 'headline', type: 'text' }],
      },
      {
        name: 'sections',
        type: 'blocks',
        blocks: [
          {
            slug: 'text',
            fields: [{ name: 'body', type: 'text' }],
          },
        ],
      },
      {
        type: 'tabs',
        tabs: [
          {
            name: 'main',
            fields: [{ name: 'tabField', type: 'number' }],
          },
        ],
      },
      { name: 'localized', type: 'text', localized: true },
    ] as never

    const out = pickConfiguredFields(
      {
        hero: { headline: 'h', leak: 1 },
        sections: [{ blockType: 'text', body: 'b', leak: 2 }],
        main: { tabField: 3 },
        localized: { en: 'hello' },
        topLeak: true,
      },
      fields,
      ['id'],
    ) as Record<string, unknown>

    expect((out.hero as Record<string, unknown>).headline).toBe('h')
    expect((out.sections as Record<string, unknown>[])[0]?.body).toBe('b')
    expect((out.main as Record<string, unknown>).tabField).toBe(3)
    expect(out.localized).toEqual({ en: 'hello' })
    expect(out.topLeak).toBeUndefined()
  })

  it('skips ui/join fields and honors extraAllowed only when present', () => {
    const fields = [
      { name: 'title', type: 'text' },
      { type: 'ui', name: 'panel' },
      { name: 'related', type: 'join', collection: 'posts', on: 'id' },
    ] as never
    const out = pickConfiguredFields({ title: 'ok', panel: {}, related: {} }, fields, ['id'])
    expect(out).toEqual({ title: 'ok' })
  })

  it('passes through unknown block types and non-record array items', () => {
    const fields = [
      {
        name: 'blocks',
        type: 'blocks',
        blocks: [{ slug: 'a', fields: [{ name: 'x', type: 'text' }] }],
      },
      { name: 'arr', type: 'array', fields: [{ name: 'n', type: 'number' }] },
    ] as never
    const out = pickConfiguredFields(
      {
        blocks: [{ blockType: 1 }, { blockType: 'a', x: 'ok' }],
        arr: [1, { n: 2 }],
      },
      fields,
    )
    expect((out.blocks as unknown[])[0]).toEqual({ blockType: 1 })
    expect((out.arr as unknown[])[0]).toBe(1)
    expect((out.arr as { n: number }[])[1]?.n).toBe(2)
    expect(
      pickConfiguredFields(
        { blocks: [{ blockType: 'a', x: 'kept' }] },
        fields,
      ),
    ).toEqual({ blocks: [{ blockType: 'a', x: 'kept' }] })

    const noBlockList = pickConfiguredFields(
      { blocks: [{ blockType: 'a', x: 1 }] },
      [{ name: 'blocks', type: 'blocks' }] as never,
    )
    expect(noBlockList.blocks).toEqual([{ blockType: 'a', x: 1 }])
  })

  it('handles tab fields, scalars, and non-object version snapshots', () => {
    const fields = [
      { name: 'solo', type: 'tab', fields: [{ name: 'only', type: 'text' }] },
      { name: 'title', type: 'text' },
    ] as never
    expect(pickConfiguredFields({ solo: { only: 's' } }, fields).solo).toEqual({ only: 's' })
    expect(pickConfiguredFields('scalar' as never, fields)).toBe('scalar')
    expect(pickConfiguredVersionRow({ id: 'v', version: 'bad' as never }, []).version).toBe('bad')
  })
})
