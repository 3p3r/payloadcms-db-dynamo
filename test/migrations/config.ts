import type { Config } from 'payload'

export const config: Partial<Config> = {
  collections: [
    {
      slug: 'posts',
      fields: [{ name: 'title', type: 'text' }],
    },
  ],
}
