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
npm run build          # esbuild → dist/ + tsc declarations
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
scripts/build.mjs    # esbuild bundle (not swc)
```

## Build & publish

- **Build:** `esbuild` compiles `src/**/*.ts` → `dist/`; `tsc --emitDeclarationOnly` emits `.d.ts`.
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

## Renaming / errors

Use `PACKAGE_NAME` or `adapterError()` from `src/packageMeta.ts` for user-visible strings. Do not reintroduce `@payloadcms/db-dynamodb` or `payload-ddb` prefixes.
