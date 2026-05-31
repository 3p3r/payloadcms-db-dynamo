import type { CollectionConfig, Config, GlobalConfig } from 'payload'

/**
 * Kitchen-sink schema fragments shared by payload-3.x and payload-4.x examples.
 * Mirrors integration-test coverage (relationships, joins, geo, localization, drafts, etc.).
 */

export const kitchenSinkLocalization: Config['localization'] = {
  locales: ['en', 'fr'],
  defaultLocale: 'en',
}

export const kitchenSinkCollections: CollectionConfig[] = [
  {
    slug: 'accounts',
    admin: { useAsTitle: 'email' },
    fields: [{ name: 'email', type: 'email', unique: true, required: true }],
  },
  {
    slug: 'authors',
    admin: { useAsTitle: 'name' },
    fields: [{ name: 'name', type: 'text', required: true }],
  },
  {
    slug: 'tags',
    admin: { useAsTitle: 'label' },
    fields: [{ name: 'label', type: 'text', required: true }],
  },
  {
    slug: 'posts',
    admin: {
      useAsTitle: 'title',
      listSearchableFields: ['title', 'body'],
    },
    versions: { drafts: true },
    fields: [
      { name: 'title', type: 'text', unique: true, required: true },
      { name: 'body', type: 'textarea' },
      { name: 'location', type: 'point' },
      { name: 'author', type: 'relationship', relationTo: 'authors' },
      { name: 'tags', type: 'relationship', relationTo: 'tags', hasMany: true },
      {
        name: 'related',
        type: 'relationship',
        relationTo: ['authors', 'tags'],
      },
      {
        name: 'category',
        type: 'relationship',
        relationTo: 'categories',
      },
    ],
  },
  {
    slug: 'categories',
    admin: { useAsTitle: 'name' },
    fields: [
      { name: 'name', type: 'text', required: true },
      {
        name: 'posts',
        type: 'join',
        collection: 'posts',
        on: 'category',
      },
    ],
  },
  {
    slug: 'places',
    admin: { useAsTitle: 'name' },
    fields: [
      { name: 'name', type: 'text', required: true },
      { name: 'location', type: 'point' },
    ],
  },
  {
    slug: 'pages',
    fields: [{ name: 'title', type: 'text', localized: true, required: true }],
  },
  {
    slug: 'docs',
    admin: { useAsTitle: 'title' },
    fields: [
      { name: 'title', type: 'text' },
      {
        name: 'meta',
        type: 'group',
        fields: [{ name: 'author', type: 'text' }],
      },
      {
        name: 'tags',
        type: 'array',
        fields: [{ name: 'label', type: 'text' }],
      },
      {
        name: 'sections',
        type: 'blocks',
        blocks: [
          { slug: 'text', fields: [{ name: 'body', type: 'textarea' }] },
          { slug: 'image', fields: [{ name: 'src', type: 'text' }] },
        ],
      },
    ],
  },
  {
    slug: 'articles',
    versions: { drafts: true },
    admin: { useAsTitle: 'title' },
    fields: [{ name: 'title', type: 'text' }],
  },
]

export const kitchenSinkGlobals: GlobalConfig[] = [
  {
    slug: 'site',
    fields: [{ name: 'siteName', type: 'text' }],
  },
  {
    slug: 'header',
    versions: true,
    fields: [{ name: 'logoText', type: 'text' }],
  },
  {
    slug: 'settings',
    fields: [{ name: 'siteName', type: 'text' }],
  },
]
