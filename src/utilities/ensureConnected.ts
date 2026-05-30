import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb'

import type { DynamoAdapter } from '../types.js'

/**
 * Idempotently set up `client` and `docClient` on the adapter. Called by both
 * `init` and `connect` because Payload's lifecycle invokes them in
 * `init → connect` order, and `init` (where table provisioning lives) needs a
 * working client before `connect` runs.
 *
 * If the user supplied their own `client`, we honor it and don't take
 * ownership for `destroy`.
 */
export function ensureConnected(adapter: DynamoAdapter): void {
  if (adapter.docClient) return

  if (!adapter.client) {
    adapter.client = new DynamoDBClient(adapter.clientConfig)
    adapter.ownsClient = true
  }

  adapter.docClient = DynamoDBDocumentClient.from(adapter.client, adapter.translateConfig)
}
