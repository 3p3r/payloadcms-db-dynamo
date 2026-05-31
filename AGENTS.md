# AGENTS.md — contributor guide

Developer setup and architecture notes for **payloadcms-db-dynamo** (npm package name). End-user documentation lives in [README.md](./README.md).

## Package identity

- **npm name:** `payloadcms-db-dynamo` (unscoped)
- **Import:** `import { dynamoAdapter } from 'payloadcms-db-dynamo'`
- **Adapter `packageName`:** `payloadcms-db-dynamo` (see `src/packageMeta.ts`)

## Prerequisites

- Node.js 20+
- Docker (for DynamoDB Local integration tests)

## Commands

```bash
npm ci
npm run build          # esbuild glob in package.json → dist/ + tsc declarations
npm run docker:start   # DynamoDB Local on :8000
npm test               # unit + integration, ≥95% coverage on src/ (needs docker)
npm run test:unit      # unit only, no DynamoDB (`vitest.unit.config.ts`)
npm run test:unit:coverage
npm run test:integration
npm run typecheck:test
```

Vitest uses **`maxWorkers: 1`** and **`fileParallelism: false`** so integration suites (each boots Payload) do not OOM WSL or low-memory CI runners.

Test env:

| Variable | Default |
|----------|---------|
| `PAYLOAD_DDB_TEST_HOST` | `localhost` |
| `PAYLOAD_DDB_TEST_PORT` | `8000` |

## Layout

```
src/                 # adapter implementation
  index.ts           # dynamoAdapter factory + exports
  config.ts          # rc defaults + resolveAdapterConfig (operational tunables)
  log.ts             # debug namespaces (root: payloadcmsDbDynamo, no dashes)
  packageMeta.ts     # PACKAGE_NAME + adapterError()
  index/             # projector + secondary index writes
  geo/               # geohash + geo-index queries
  schema/            # CreateTable + GSI definitions
  transactions/      # buffered TransactWriteItems
  utilities/         # query, filter, projection
test/
  unit/              # mocked, fast
  **/*.int.spec.ts   # DynamoDB Local + Payload
  fixtures/migrations/  # checked-in migration for migrateFresh test
  __helpers/         # initPayloadTest, mockAdapter, mockDynamoSend
```

Runtime dependencies: `debug`, `rc`, `exponential-backoff`, `lodash` (per-method ESM imports).

## Build & publish

- **Build:** `esbuild src/**/*.ts` (via `package.json` script) → `dist/`; `tsc --emitDeclarationOnly` emits `.d.ts`.
- **Publish:** `package.json` `"files": ["dist"]`; `.npmignore` excludes source and tests. `prepublishOnly` runs `npm run build`.
- Dry run: `npm pack --dry-run`

## Coverage

`vitest.config.ts` enforces **≥95%** lines, statements, functions, and branches on `src/` (excluding `types.ts`, transaction types, migration-utils export).

## CI

`.github/workflows/test.yml` — Payload 3 and 4 matrix against DynamoDB Local service on port 8000.

## Test fixtures

`test/fixtures/migrations/20250530_smoke.js` is **intentionally committed** — used by `migrate-fresh.int.spec.ts` to assert `migrateFresh` runs migrations after recreating the table.

## Architecture (short)

- **Single table:** `pk` = collection/global slug (or versions partition); `sk` = document id (globals use `sk === slug`).
- **Reads:** inverted-index / `gsi1` list / geo-index GSI queries when possible; otherwise partition `Query` + `FilterExpression`; JS-only operators (`like`, etc.) scan in memory.
- **Writes:** read-merge-`Put` with `pickConfiguredFields` so undeclared keys never persist.
- **Versions:** separate `*_versions` partition; `latest` flag flipped via `TransactWriteItems` on create.

### Query paths (implementation)

- **Indexed equality:** Declared collection indexes write `IDX#{slug}#{field}#{value}` rows; equality on an indexed field queries that partition instead of scanning the collection partition.
- **List sorting:** `gsi1` with `gsi1pk` = `COL#{slug}#LIST` and `gsi1sk` derived from the sort field + id; unfiltered lists use this GSI; filtered lists use partition `Query` + `FilterExpression`.
- **Geo:** `point` fields write geohash rows (`GEO#…`) queried via the `geo-index` GSI ([dynamodb-geo-v3](https://www.npmjs.com/package/dynamodb-geo-v3) / S2 coverage).
- **Search:** Admin list search uses n-gram rows (`entityType: ngm`) when `admin.listSearchableFields` / `useAsTitle` are configured.
- **Transactions:** Buffered `TransactWriteItems` in `dynamoSend`; commits chunk at `adapter.config.transactChunkSize` (max 100).

## Configuration (`rc`)

Operational tunables are loaded with [`rc`](https://www.npmjs.com/package/rc) (`@types/rc`), app name `payloadcms-db-dynamo`. Factory `dynamoAdapter(args)` overrides rc/env.

Defaults live in [`src/config.ts`](src/config.ts) as `defaultConfig`; resolved snapshot is `adapter.config` on the adapter instance.

| rc / env key (examples) | Purpose |
|-------------------------|---------|
| `payloadcms-db-dynamo_tableName` | Default table name |
| `payloadcms-db-dynamo_batchWriteChunkSize` | BatchWrite delete chunk (max 25) |
| `payloadcms-db-dynamo_batchWriteMaxRetries` | Unprocessed item retries |
| `payloadcms-db-dynamo_batchGetChunkSize` | BatchGet chunk (max 100) |
| `payloadcms-db-dynamo_searchNgramLength` | Search n-gram length |
| `payloadcms-db-dynamo_geoHashKeyLength` | Geo hash prefix length |
| `payloadcms-db-dynamo_warnOnMigrateFresh` | Log destructive `migrateFresh` warning |

Schema identifiers (`gsi1`, `geo-index`, `pk`/`sk`, entity key templates) are **not** rc-tunable — they must match provisioned table definition in `src/schema/`.

## Debug logging

Uses [`debug`](https://www.npmjs.com/package/debug). Root namespace **`payloadcmsDbDynamo`** (no dashes — required for `DEBUG` pattern matching).

```bash
DEBUG=payloadcmsDbDynamo:* npm run dev
DEBUG=payloadcmsDbDynamo:batchWrite npm test
```

- Exported: `DEBUG_ROOT` and `log(ns)` from [`src/log.ts`](src/log.ts) / package entry.
- Sub-namespaces: `connect`, `init`, `ensureTable`, `migrateFresh`, `dynamoSend`, `transaction`, `batchWrite`, `batchGet`, `query`, `geo`, `projector`, `scrub`.
- Payload `payload.logger` is reserved for rare user-visible messages (table creation, `migrateFresh` warning).

## Renaming / errors

Use `PACKAGE_NAME` or `adapterError()` from `src/packageMeta.ts` for user-visible strings. Do not reintroduce `@payloadcms/db-dynamodb` or `payload-ddb` prefixes.
