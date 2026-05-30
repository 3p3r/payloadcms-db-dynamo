import type { Config } from 'payload'

export const config: Partial<Config> = {
  collections: [
    {
      slug: 'items',
      fields: [
        { name: 'title', type: 'text' },
        { name: 'score', type: 'number' },
      ],
    },
    {
      slug: 'drafts-on',
      versions: { drafts: true },
      fields: [
        { name: 'title', type: 'text' },
        { name: 'priority', type: 'number' },
      ],
    },
    {
      slug: 'versioned',
      versions: true,
      fields: [{ name: 'title', type: 'text' }],
    },
  ],
  globals: [
    {
      slug: 'header',
      versions: true,
      fields: [{ name: 'logoText', type: 'text' }],
    },
    {
      slug: 'ghost',
      fields: [{ name: 'logoText', type: 'text' }],
    },
  ],
}
