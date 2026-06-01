import type { Config } from 'payload'

export const config: Partial<Config> = {
  collections: [
    {
      slug: 'accounts',
      fields: [{ name: 'email', type: 'email', unique: true }],
    },
  ],
}
