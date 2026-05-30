/**
 * Read a dotted path from a record. Returns `undefined` if any segment along
 * the way is missing or non-object.
 *
 * Intentionally simple — does not support array index syntax, escaped dots,
 * or symbol keys. Field paths in Payload's `Where` are dotted strings.
 */
export function getByPath(source: unknown, path: string): unknown {
  if (source === null || typeof source !== 'object') {
    return undefined
  }
  const segments = path.split('.')
  let cursor: unknown = source
  for (const segment of segments) {
    if (cursor === null || typeof cursor !== 'object') {
      return undefined
    }
    cursor = (cursor as Record<string, unknown>)[segment]
  }
  return cursor
}
