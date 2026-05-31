# Examples

Runnable [Payload](https://payloadcms.com) kitchen-sink backends wired to **payloadcms-db-dynamo** and DynamoDB Local.

| Directory | Payload | Port | DynamoDB table |
|-----------|---------|------|----------------|
| [payload-3.x](./payload-3.x) | `3.84.1` | `3000` | `payload-kitchen-sink-3` |
| [payload-4.x](./payload-4.x) | `4.0.0-internal.e16cf59` | `3001` | `payload-kitchen-sink-4` |

Both examples can run **at the same time** against one DynamoDB Local instance because they use different table names.

## From the repo root

```bash
npm run example:3x      # http://localhost:3000/admin
npm run example:4x      # http://localhost:3001/admin
npm run examples        # frees 3000/3001, then both dev servers in parallel
npm run examples:stop   # fuser -k on 3000 and 3001
```

## Inside an example

```bash
cd examples/payload-3.x   # or payload-4.x
npm run setup   # .env, install, adapter build, docker:start
npm run dev     # predev runs setup, then Next
npm run stop    # fuser -k for this app's port
npm run start   # production (next start, after npm run build)
```

Payload 4.x uses `next dev --webpack` (see [payload-4.x/README.md](./payload-4.x/README.md)).

## Shared schema

Kitchen-sink definitions: [`shared/kitchenSink.ts`](./shared/kitchenSink.ts). After editing, run `npm run sync:shared` inside an example to refresh `src/kitchenSink.ts`.
