import get from 'lodash/get.js'

/**
 * Read a dotted path from a record. Returns `undefined` if any segment along
 * the way is missing or non-object.
 *
 * Intentionally simple — does not support array index syntax, escaped dots,
 * or symbol keys. Field paths in Payload's `Where` are dotted strings.
 */
export function getPath(source: unknown, path: string): unknown {
  if (source === null || source === undefined) {
    return undefined
  }
  return get(source, path.split('.'))
}
