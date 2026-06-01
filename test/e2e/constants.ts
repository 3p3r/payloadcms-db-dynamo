/** Max wait for any single expect or navigation (2 minutes). */
export const MAX_MS = 120_000

/** Default timeout for actions (clicks, fills). */
export const ACTION_MS = 30_000

/** Kitchen-sink collection slugs (shared schema + example-only). */
export const COLLECTIONS = {
  users: 'users',
  media: 'media',
  accounts: 'accounts',
  authors: 'authors',
  tags: 'tags',
  posts: 'posts',
  categories: 'categories',
  places: 'places',
  pages: 'pages',
  docs: 'docs',
  articles: 'articles',
} as const

export const GLOBALS = {
  site: 'site',
  header: 'header',
  settings: 'settings',
} as const
