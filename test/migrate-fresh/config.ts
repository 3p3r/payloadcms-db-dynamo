import type { Config } from 'payload'

export const config: Partial<Config> = {
  collections: [
    {
      slug: 'items',
      fields: [{ name: 'label', type: 'text' }],
    },
  ],
}
