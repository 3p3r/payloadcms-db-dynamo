import type { Config } from 'payload'

export const config: Partial<Config> = {
  collections: [
    {
      slug: 'items',
      fields: [{ name: 'title', type: 'text' }],
    },
    {
      slug: 'users',
      auth: true,
      admin: { useAsTitle: 'email' },
      fields: [],
    },
  ],
}
