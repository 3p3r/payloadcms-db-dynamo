/**
 * Convert values that DynamoDB's marshaller can't represent natively into a
 * shape it can. Today this is just `Date → ISO string`, but the same hook is
 * the right place for any future "Payload sends X, Dynamo wants Y" coercions
 * (e.g. `BigInt`).
 */
export function normalizeForDynamo(value: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(value)) {
    out[k] = normalizeFilterValue(v)
  }
  return out
}

/** Normalize a single filter operand (may be scalar, Date, or nested object). */
export function normalizeFilterValue(value: unknown): unknown {
  if (value === null || value === undefined) return value
  if (value instanceof Date) return value.toISOString()
  if (Array.isArray(value)) return value.map((entry) => normalizeFilterValue(entry))
  if (typeof value === 'object') {
    const nested: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(value)) {
      nested[k] = normalizeFilterValue(v)
    }
    return nested
  }
  return value
}
