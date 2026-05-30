import type { Config } from 'payload'

export const config: Partial<Config> = {
  localization: {
    locales: ['en', 'fr'],
    defaultLocale: 'en',
  },
  collections: [
    {
      slug: 'pages',
      fields: [{ name: 'title', type: 'text', localized: true }],
    },
  ],
}
