import type { Config } from 'payload'

export const config: Partial<Config> = {
  collections: [
    {
      slug: 'posts',
      fields: [
        { name: 'title', type: 'text', unique: true },
        { name: 'location', type: 'point' },
      ],
      versions: { drafts: true },
    },
    {
      slug: 'accounts',
      fields: [
        { name: 'email', type: 'email', unique: true },
      ],
    },
  ],
  globals: [
    {
      slug: 'settings',
      fields: [{ name: 'siteName', type: 'text' }],
    },
  ],
}
