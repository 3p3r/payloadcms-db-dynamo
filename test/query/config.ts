import type { Config } from 'payload'

export const config: Partial<Config> = {
  collections: [
    {
      slug: 'items',
      admin: {
        listSearchableFields: ['name', 'description'],
      },
      fields: [
        { name: 'name', type: 'text' },
        { name: 'category', type: 'text' },
        { name: 'priority', type: 'number' },
        { name: 'active', type: 'checkbox' },
        { name: 'description', type: 'text' },
      ],
    },
  ],
}
