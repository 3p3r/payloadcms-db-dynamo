import { vi } from 'vitest'

import { resolveAdapterConfig } from '../../src/config.js'
import type { AdapterRcConfig } from '../../src/config.js'
import { PACKAGE_NAME } from '../../src/packageMeta.js'
import type { DynamoAdapter } from '../../src/types.js'

const defaultConfig = resolveAdapterConfig()

function baseAdapterFields(
  config: AdapterRcConfig = defaultConfig,
): Pick<
  DynamoAdapter,
  'config' | 'tableName' | 'ensureTables' | 'bulkOperationsSingleTransaction' | 'resolvePartition' | 'resolveVersionsPartition'
> {
  return {
    config,
    tableName: config.tableName,
    ensureTables: config.ensureTables,
    bulkOperationsSingleTransaction: config.bulkOperationsSingleTransaction,
    resolvePartition: (s: string) => s,
    resolveVersionsPartition: (s: string) => `${s}_versions`,
  }
}

/** Adapter skeleton without `docClient` / `client` — for guard-rail tests. */
export function bareAdapter(overrides: Partial<DynamoAdapter> = {}): DynamoAdapter {
  const config = overrides.config ?? defaultConfig
  const base = {
    name: 'dynamodb',
    packageName: PACKAGE_NAME,
    client: undefined,
    docClient: undefined,
    clientConfig: {},
    translateConfig: {},
    ownsClient: false,
    transactionSessions: {},
    sessions: {},
    payload: {
      config: { collections: [], globals: [] },
      logger: { info: () => {}, warn: () => {}, error: () => {}, debug: () => {} },
    },
    ...baseAdapterFields(config),
    ...overrides,
  }
  return base as DynamoAdapter
}

/** Adapter with a mock `docClient.send` and empty transaction map. */
export function mockAdapter(
  overrides: Partial<DynamoAdapter> & {
    send?: ReturnType<typeof vi.fn>
  } = {},
): DynamoAdapter {
  const { send, transactionSessions: txOverride, sessions: _sessions, ...rest } = overrides
  const transactionSessions = txOverride ?? {}
  return bareAdapter({
    docClient: { send: send ?? vi.fn().mockResolvedValue({}) },
    transactionSessions,
    sessions: transactionSessions,
    payload: {
      collections: {},
      config: { globals: [] },
      logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn(), debug: vi.fn() },
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
  } as DynamoAdapter['payload']
}

export function writeAdapter(send = vi.fn().mockResolvedValue({})): DynamoAdapter {
  return mockAdapter({ send, payload: writeTestPayload() })
}
