import { vi } from 'vitest'

type QueryResult = {
  Items?: Record<string, unknown>[]
  LastEvaluatedKey?: Record<string, unknown>
  Count?: number
}

/** Build a `docClient.send` mock keyed by partition (`:pk` in Query commands). */
export function mockSendByPartition(
  handlers: Record<string, QueryResult | (() => QueryResult | Promise<QueryResult>)>,
) {
  return vi.fn().mockImplementation((cmd: { input?: { ExpressionAttributeValues?: Record<string, string> } }) => {
    const pk = cmd.input?.ExpressionAttributeValues?.[':pk']
    const handler = pk ? handlers[pk] : undefined
    if (!handler) return Promise.resolve({ Items: [] })
    return Promise.resolve(typeof handler === 'function' ? handler() : handler)
  })
}
