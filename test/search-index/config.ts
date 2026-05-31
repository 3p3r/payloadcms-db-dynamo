import type { Config } from 'payload'

export const config: Partial<Config> = {
  collections: [
    {
      slug: 'articles',
      admin: {
        listSearchableFields: ['title', 'body'],
        useAsTitle: 'title',
      },
      fields: [
        { name: 'title', type: 'text', required: true },
        { name: 'body', type: 'text' },
      ],
    },
  ],
}
