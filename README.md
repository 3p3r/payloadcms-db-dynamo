# @payloadcms/db-dynamodb

DynamoDB database adapter for [Payload CMS](https://payloadcms.com) using a **single-table** design (`pk` + `sk`) with optional GSIs for list/sort, inverted indexes, and geo queries.

## Requirements

- Payload `>=3.49.0 <5.0.0`
- Node.js 20+
- [DynamoDB Local 3.x](https://hub.docker.com/r/amazon/dynamodb-local) for development and tests

## Installation

```bash
npm install @payloadcms/db-dynamodb payload
```

## Usage

```ts
import { buildConfig } from 'payload'
import { dynamoAdapter } from '@payloadcms/db-dynamodb'

export default buildConfig({
  db: dynamoAdapter({
    tableName: 'payload',
    ensureTables: true, // dev only — provision table + GSIs on init
    clientConfig: {
      region: 'us-east-1',
      endpoint: process.env.DYNAMODB_ENDPOINT, // e.g. http://localhost:8000
      credentials: {
        accessKeyId: 'test',
        secretAccessKey: 'test',
      },
    },
  }),
  // ...
})
```

## Generate table schema

```bash
payload generate:db-schema
```

Emits `payload-generated-dynamodb.json` (or a path via `generateSchema({ outputFile })`) with `CreateTable` input, GSI definitions, and per-collection index/geo metadata.

## Integration tests (definition of done)

```bash
npm run docker:start   # amazon/dynamodb-local:3.x on :8000
npm test               # integration + unit tests, ≥95% src coverage (single worker)
npm run test:unit      # unit tests only (no DynamoDB)
npm run build          # esbuild + TypeScript declarations
```

Vitest runs with `maxWorkers: 1` so integration suites (each booting Payload) do not OOM constrained environments like WSL.

Override host/port with `PAYLOAD_DDB_TEST_HOST` and `PAYLOAD_DDB_TEST_PORT` (default `localhost:8000`).

## Features

- Full `BaseDatabaseAdapter` coverage (CRUD, versions, drafts, globals, migrations, `generateSchema`)
- Payload-context **transactions** (`beginTransaction` / `commitTransaction` / `rollbackTransaction`) via buffered `TransactWriteItems`
- Geo operators: `near`, `within`, `intersects` on `point` fields
- Query operators: `equals`, comparisons, `in` / `not_in` / `all`, `exists`, `like` / `not_like` / `contains`, `and` / `or`
- Join field resolution on `find` / `findOne`
- Strict field projection (unknown keys stripped on write)

## License

MIT
