import { vi } from 'vitest'

import type { DynamoAdapter } from '../../src/types.js'

/** Adapter skeleton without `docClient` / `client` — for guard-rail tests. */
export function bareAdapter(overrides: Partial<DynamoAdapter> = {}): DynamoAdapter {
  return {
    client: undefined,
    docClient: undefined,
    tableName: 't',
    payload: {
      config: { collections: [], globals: [] },
      logger: { info: () => {}, warn: () => {}, error: () => {} },
    },
    resolvePartition: (s: string) => s,
    resolveVersionsPartition: (s: string) => `${s}_versions`,
    ...overrides,
  } as DynamoAdapter
}

/** Adapter with a mock `docClient.send` and empty transaction map. */
export function mockAdapter(
  overrides: Partial<DynamoAdapter> & {
    send?: ReturnType<typeof vi.fn>
  } = {},
): DynamoAdapter {
  const { send, ...rest } = overrides
  return bareAdapter({
    docClient: { send: send ?? vi.fn().mockResolvedValue({}) },
    transactionSessions: {},
    payload: {
      collections: {},
      config: { globals: [] },
      logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn() },
    },
    ...rest,
  })
}

/** Payload config used by write-path unit tests. */
export function writeTestPayload(): DynamoAdapter['payload'] {
  return {
    collections: {
      posts: { config: { fields: [{ name: 'title', type: 'text' }] } },
      header: { config: { fields: [{ name: 'logoText', type: 'text' }] } },
    },
    config: { globals: [{ slug: 'header', fields: [{ name: 'logoText', type: 'text' }] }] },
  } as never
}

export function writeAdapter(send = vi.fn().mockResolvedValue({})): DynamoAdapter {
  return mockAdapter({ send, payload: writeTestPayload() })
}
