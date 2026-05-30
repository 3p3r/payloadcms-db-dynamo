# payloadcms-db-dynamo

DynamoDB database adapter for [Payload CMS](https://payloadcms.com). Stores collections, globals, and version rows in a **single-table** layout (`pk` + `sk`) with optional GSIs for sorting, inverted indexes, and geo queries.

## Requirements

- [Payload](https://payloadcms.com) `>=3.49.0 <5.0.0`
- Node.js 20+

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

### Options (common)

| Option | Description |
|--------|-------------|
| `tableName` | Physical DynamoDB table name (default `payload`). |
| `clientConfig` | Passed to `DynamoDBClient` (region, endpoint, credentials, retries). |
| `client` | Inject an existing `DynamoDBClient` (adapter will not destroy it). |
| `ensureTables` | When `true`, create the table and GSIs during `init` if missing. |
| `migrationDir` | Directory for migration files (default `migrations`). |
| `bulkOperationsSingleTransaction` | Buffer bulk writes into one transaction per request when possible. |

## Table schema

Generate a JSON (or TypeScript) description of the table, GSIs, and per-collection metadata:

```bash
npx payload generate:db-schema
```

By default this writes `src/payload-generated-dynamodb.json`. Pass `generateSchema({ outputFile: '...' })` on the adapter to customize the path.

Use that output with your IaC tool (CDK, Terraform, CloudFormation) to provision the table in AWS.

## Migrations

Works with Payload’s migration commands (`migrate`, `migrate:status`, `migrate:down`, `migrate:reset`, `migrate:fresh`). Point `migrationDir` at your project’s migration folder.

`migrateFresh` drops and recreates the table, then re-runs migrations — destructive; use only in development.

## Transactions

Supports Payload request transactions via buffered `TransactWriteItems` (`beginTransaction` / `commitTransaction` / `rollbackTransaction`).

## Query & data behavior

- **Where operators:** `equals`, comparisons, `in` / `not_in` / `all`, `exists`, `like` / `not_like` / `contains`, `and` / `or`, plus geo `near` / `within` / `intersects` on `point` fields.
- **Join fields:** Resolved on `find` / `findOne`.
- **Strict writes:** Unknown fields in request bodies are stripped on write (same idea as strict SQL/ODM adapters), including nested groups, arrays, and blocks.

## One-shot cleanup after upgrade

If rows were written before strict projection was enabled, run the exported helper once:

```ts
import { getPayload } from 'payload'
import config from './payload.config'
import { scrubUnknownFields } from 'payloadcms-db-dynamo'

const payload = await getPayload({ config })
const report = await scrubUnknownFields(payload)
console.log(report)
await payload.destroy()
```

## Typing migrations (optional)

Migration files receive `{ payload, req, session }` from Payload. For TypeScript migrations, import the argument types:

```ts
import type { MigrateDownArgs, MigrateUpArgs } from 'payloadcms-db-dynamo/migration-utils'

export async function up({ payload }: MigrateUpArgs) {
  // ...
}

export async function down({ payload }: MigrateDownArgs) {
  // ...
}
```

Plain `.js` migrations do not need this import.

## License

MIT
