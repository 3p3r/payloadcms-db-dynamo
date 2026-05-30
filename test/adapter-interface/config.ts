import type { Config } from 'payload'

export const config: Partial<Config> = {
  collections: [
    {
      slug: 'items',
      fields: [{ name: 'label', type: 'text' }],
    },
  ],
  globals: [
    {
      slug: 'site',
      fields: [{ name: 'title', type: 'text' }],
    },
  ],
}
