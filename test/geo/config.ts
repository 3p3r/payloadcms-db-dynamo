import type { Config } from 'payload'

export const config: Partial<Config> = {
  collections: [
    {
      slug: 'places',
      fields: [
        { name: 'name', type: 'text' },
        { name: 'location', type: 'point' },
      ],
    },
  ],
}
