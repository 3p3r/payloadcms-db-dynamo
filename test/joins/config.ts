import type { Config } from 'payload'

export const config: Partial<Config> = {
  collections: [
    {
      slug: 'categories',
      fields: [
        { name: 'name', type: 'text' },
        {
          name: 'posts',
          type: 'join',
          collection: 'posts',
          on: 'category',
        },
      ],
    },
    {
      slug: 'posts',
      fields: [
        { name: 'title', type: 'text' },
        {
          name: 'category',
          type: 'relationship',
          relationTo: 'categories',
        },
      ],
    },
  ],
}
