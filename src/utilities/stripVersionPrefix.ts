import type { Where } from 'payload'

/** Strip `version.` prefixes from where keys after Payload rewrites draft queries. */
export function stripVersionPrefix(where: Where | null | undefined): Where | null | undefined {
  if (!where || typeof where !== 'object') return where
  const result: Where = {}
  for (const [key, value] of Object.entries(where)) {
    if (key === 'and' || key === 'or') {
      if (Array.isArray(value)) {
        result[key] = value.map((sub) => stripVersionPrefix(sub as Where)).filter(Boolean) as Where[]
      }
    } else {
      result[key.startsWith('version.') ? key.slice(8) : key] = value as Where[string]
    }
  }
  return result
}
