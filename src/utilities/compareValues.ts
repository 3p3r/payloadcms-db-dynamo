/** Shared ascending comparison for in-memory sort and where operators. */
export function compareValues(a: unknown, b: unknown): number {
  if (a === b) return 0
  const aMissing = a === undefined || a === null
  const bMissing = b === undefined || b === null
  if (aMissing && bMissing) return 0
  if (aMissing) return -1
  if (bMissing) return 1
  if (typeof a === 'number' && typeof b === 'number') return a - b
  const as = String(a)
  const bs = String(b)
  return as < bs ? -1 : as > bs ? 1 : 0
}

/** Like compareValues but returns NaN when either side is nullish (filter semantics). */
export function compareValuesLoose(a: unknown, b: unknown): number {
  if (a === undefined || a === null || b === undefined || b === null) return NaN
  return compareValues(a, b)
}
