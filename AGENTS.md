# AGENTS.md — contributor guide

Developer setup and architecture notes for **payloadcms-db-dynamo** (npm package name). End-user documentation lives in [README.md](./README.md).

## Conventions (agents)

- **No ad hoc scripts.** Do not add files under `scripts/` or other one-off `.mjs`/`.sh` helpers. Use `package.json` scripts (esbuild/tsc CLI, `npm-run-all`, small shell fragments), existing test helpers under `test/__helpers/`, or extend an established module in `src/`.
- **No `&&` / `||` in `package.json` scripts.** Chain steps with `npm-run-all` (sequential `npm-run-all a b c` or `npm-run-all foo:*`). Use `test/__helpers/` for conditional logic (e.g. `docker:ensure`).

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
npm run build          # bundled dist/index.js + dist/index.d.ts
npm run docker:ensure  # start DynamoDB Local only if :8000 is not already up (CI-safe)
npm run docker:start   # force docker compose up
npm test               # unit + integration, ≥95% coverage on src/ (needs docker)
npm run test:unit      # unit only, no DynamoDB (`vitest.unit.config.ts`)
npm run test:unit:coverage
npm run test:integration
npm run test:e2e          # Playwright — kitchen-sink admin UI on examples/ (needs docker; Payload 4 needs Node 24+)
npm run test:e2e:install  # one-time Chromium install for Playwright
npm run typecheck:test
```

Vitest uses **`maxWorkers: 1`** and **`fileParallelism: false`** so integration suites (each boots Payload) do not OOM WSL or low-memory CI runners.

Test env:

| Variable | Default |
|----------|---------|
| `PAYLOAD_DDB_TEST_HOST` | `localhost` |
| `PAYLOAD_DDB_TEST_PORT` | `8000` |

## Examples

Runnable kitchen-sink Payload apps: [examples/README.md](./examples/README.md) (`payload-3.x` on port 3000 / table `payload-kitchen-sink-3`, `payload-4.x` on 3001 / `payload-kitchen-sink-4`). Start DynamoDB with `npm run docker:start` at the repo root only — examples do not ship their own compose file.

## Layout

```
examples/            # payload-3.x, payload-4.x, shared kitchenSink schema
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
  e2e/               # Playwright against examples (canonical real-world gate)
  unit/              # mocked, fast
  **/*.int.spec.ts   # DynamoDB Local + minimal Payload configs (adapter coverage)
  fixtures/migrations/  # checked-in migration for migrateFresh test
  __helpers/         # initPayloadTest, mockAdapter, mockDynamoSend
```

Runtime dependencies: `debug`, `rc`, `exponential-backoff`, `lodash` (per-method ESM imports).

## Build & publish

- **Build:** `npm run build` — `build:clean` then `build:adapter`. Examples use `build:adapter` only (no clean) so parallel `predev` does not `rm -rf dist/` while Next reads `dist/index.js`. `build:source:*` / `build:types:*` — bundle → `dist/index.js` + `dist/index.d.ts`. Migration types (`MigrateUpArgs`, `MigrateDownArgs`) export from the main entry only.
- **DynamoDB Local:** `docker:ensure` runs `test/__helpers/ensureDynamodbLocal.ts` (probe via `ListTables`, then `docker:start` + `assertDbReachable` if needed).
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

- **Indexed equality (forward):** Declared collection indexes write `IDX#{slug}#{field}#{value}` rows; `equals` / `in` on an indexed field query that `pk` partition (consistent read).
- **Indexed reverse (`gsi2`):** The same index rows set `gsi2pk=IDX#{slug}#{field}`; `exists`, `not_equals`, and `not_in` on a declared index query `gsi2` and hydrate docs (filtering excluded values via row `pk`).
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
