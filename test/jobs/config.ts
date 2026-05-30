import type { Config } from 'payload'

export const config: Partial<Config> = {
  collections: [
    {
      slug: 'payload-jobs',
      fields: [
        { name: 'taskSlug', type: 'text' },
        { name: 'completedAt', type: 'date' },
      ],
    },
  ],
}
