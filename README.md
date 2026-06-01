# payloadcms-db-dynamo

DynamoDB database adapter for [Payload CMS](https://payloadcms.com). Stores collections, globals, and version rows in a **single-table** layout with GSIs for sorting, indexed lookups, and geo queries.

> **Status:** this entire project is vibe coded in a weekend, but it has two full working kitchen sink examples checked in. *Use at your own risk*. I made this to be able to deploy Payload CMS into AWS Lambda with OpenNext and have its data backed into DynamoDB, to pay $0 when scaled to zero.

## Requirements

- [Payload](https://payloadcms.com) `>=3.49.0 <5.0.0`
- Node.js 20+

## Examples

Kitchen-sink Payload **3.x** and **4.x** apps that use this adapter with the repo-root DynamoDB Local compose file: [examples/README.md](./examples/README.md).

## Install

```bash
npm install payloadcms-db-dynamo payload
```

## Configure

```ts
import { buildConfig } from 'payload'
import { dynamoAdapter } from 'payloadcms-db-dynamo'

export default buildConfig({
  db: dynamoAdapter({
    tableName: 'payload',
    // Optional: create the table on init (local dev / DynamoDB Local only).
    // In AWS, provision the table with IaC instead.
    ensureTables: true,
    clientConfig: {
      region: process.env.AWS_REGION ?? 'us-east-1',
      endpoint: process.env.DYNAMODB_ENDPOINT, // e.g. http://localhost:8000
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID ?? 'test',
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY ?? 'test',
      },
    },
  }),
  // collections, globals, ...
})
```

### Options

| Option | Description |
|--------|-------------|
| `tableName` | Physical DynamoDB table name (default `payload`). |
| `clientConfig` | Passed to `DynamoDBClient` (region, endpoint, credentials, retries). |
| `client` | Inject an existing `DynamoDBClient` (adapter will not destroy it). |
| `ensureTables` | When `true`, create the table and GSIs during `init` if missing. |
| `migrationDir` | Directory for migration files (default `migrations`). |
| `bulkOperationsSingleTransaction` | When `true`, `updateMany` / `deleteMany` run inside one transaction per request when `req` has no transaction yet. DynamoDB limits each transact to **100 items**; larger bulks are split automatically on commit. |

## Table schema

Generate a JSON description of the table, GSIs, and per-collection metadata for your IaC tool:

```bash
npx payload generate:db-schema
```

By default this writes `src/payload-generated-dynamodb.json`. Pass `generateSchema({ outputFile: '...' })` on the adapter to customize the path.

## Migrations

Works with Payload’s migration commands (`migrate`, `migrate:status`, `migrate:down`, `migrate:reset`, `migrate:fresh`). Point `migrationDir` at your project’s migration folder.

`migrateFresh` drops and recreates the table, then re-runs migrations — destructive; use only in development.

## Transactions

Supports Payload request transactions (`beginTransaction` / `commitTransaction` / `rollbackTransaction`).

## Query & writes

- **Where:** `equals`, comparisons, `in` / `not_in` / `all`, `exists`, `like` / `not_like` / `contains`, `and` / `or`, plus geo `near` / `within` / `intersects` on `point` fields.
- **Collections:** Declared indexes use forward `IDX#…#value` partitions for `equals` / `in`, and the `gsi2` reverse index for `exists` / `not_equals` / `not_in` on that field; default list sorting uses the configured sort field (typically `createdAt`).
- **Geo:** `point` fields support radius and bounding-box style queries.
- **Join fields:** Resolved on `find` / `findOne`.
- **Updates:** Optimistic concurrency via `updatedAt`; unknown fields in request bodies are not persisted.

## One-shot cleanup after upgrade

If rows were written before strict field projection was enabled, run the exported helper once:

```ts
import { getPayload } from 'payload'
import config from './payload.config'
import { scrubUnknownFields } from 'payloadcms-db-dynamo'

const payload = await getPayload({ config })
const report = await scrubUnknownFields(payload)
await payload.destroy()
```

## Typing migrations (optional)

Migration files receive `{ payload, req, session }` from Payload. For TypeScript migrations, import the argument types:

```ts
import type { MigrateDownArgs, MigrateUpArgs } from 'payloadcms-db-dynamo'

export async function up({ payload }: MigrateUpArgs) {
  // ...
}

export async function down({ payload }: MigrateUpArgs) {
  // ...
}
```

Plain `.js` migrations do not need this import.

## License

MIT
