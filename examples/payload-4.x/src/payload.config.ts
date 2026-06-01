import { lexicalEditor } from '@payloadcms/richtext-lexical'
import path from 'path'
import { buildConfig } from 'payload'
import { fileURLToPath } from 'url'
import sharp from 'sharp'
import { dynamoAdapter } from 'payloadcms-db-dynamo'

import {
  kitchenSinkCollections,
  kitchenSinkGlobals,
  kitchenSinkLocalization,
} from '../../shared/kitchenSink.js'
import { Media } from './collections/Media'
import { Users } from './collections/Users'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

const tableName = process.env.DYNAMODB_TABLE_NAME ?? 'payload-kitchen-sink-4'

export default buildConfig({
  admin: {
    user: Users.slug,
    importMap: {
      baseDir: path.resolve(dirname),
    },
  },
  collections: [Users, Media, ...kitchenSinkCollections],
  globals: kitchenSinkGlobals,
  localization: kitchenSinkLocalization,
  editor: lexicalEditor(),
  secret: process.env.PAYLOAD_SECRET || 'kitchen-sink-dev-secret',
  typescript: {
    outputFile: path.resolve(dirname, 'payload-types.ts'),
  },
  db: dynamoAdapter({
    tableName,
    ensureTables: true,
    clientConfig: {
      region: process.env.AWS_REGION ?? 'us-east-1',
      endpoint: process.env.DYNAMODB_ENDPOINT ?? 'http://localhost:8000',
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID ?? 'test',
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY ?? 'test',
      },
    },
  }),
  sharp,
  plugins: [],
})
