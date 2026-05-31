import type { Payload } from 'payload'

export type SeedOptions = {
  email?: string
  password?: string
}

const DEFAULT_EMAIL = 'admin@example.com'
const DEFAULT_PASSWORD = 'password'

/**
 * Create a first admin user and sample kitchen-sink documents.
 */
export async function seedKitchenSink(
  payload: Payload,
  options: SeedOptions = {},
): Promise<void> {
  const email = options.email ?? DEFAULT_EMAIL
  const password = options.password ?? DEFAULT_PASSWORD

  const existing = await payload.find({
    collection: 'users',
    where: { email: { equals: email } },
    limit: 1,
  })

  if (existing.docs.length === 0) {
    await payload.create({
      collection: 'users',
      data: { email, password },
    })
    payload.logger.info(`Created admin user ${email}`)
  }

  const postCount = await payload.count({ collection: 'posts' })
  if (postCount.totalDocs === 0) {
    const author = await payload.create({
      collection: 'authors',
      data: { name: 'Ada Lovelace' },
    })
    await payload.create({
      collection: 'posts',
      data: {
        title: 'Hello DynamoDB',
        body: 'Kitchen sink example post',
        author: author.id,
        _status: 'published',
      },
    })
  }

  const placeCount = await payload.count({ collection: 'places' })
  if (placeCount.totalDocs === 0) {
    await payload.create({
      collection: 'places',
      data: {
        name: 'Payload HQ',
        location: [-122.4194, 37.7749],
      },
    })
  }
}

export const seedCredentials = {
  email: DEFAULT_EMAIL,
  password: DEFAULT_PASSWORD,
}
