# Integration tests

Vitest-based test harness. Each spec boots its own Payload instance against a
uniquely-named table on a shared **DynamoDB Local** container.

## Run

```bash
npm run docker:start   # amazon/dynamodb-local (default :8000)
npm test               # integration specs + ≥95% coverage on src/
npm run test:watch     # vitest watch (no coverage gate)
npm run docker:stop
```

`npm test` fails fast if DynamoDB Local is unreachable. Override with
`PAYLOAD_DDB_TEST_HOST` / `PAYLOAD_DDB_TEST_PORT`.

## Layout

See suite directories under `test/` (`connect`, `crud`, `query`, `versions`,
`globals`, `transactions`, `geo`, `generate-schema`, etc.).

Each suite has `config.ts` plus `*.int.spec.ts`. `__helpers/` provides
`initPayload`, `buildConfigWithDefaults`, and table lifecycle utilities.
