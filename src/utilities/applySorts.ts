import type { Sort } from 'payload'

import { compareValues } from './compareValues.js'
import { getPath } from './getPath.js'

export function applySorts(items: Record<string, unknown>[], sort: Sort | undefined): void {
  if (!sort) return
  const keys = Array.isArray(sort) ? sort : [sort]
  if (keys.length === 0) return

  items.sort((a, b) => {
    for (const raw of keys) {
      if (!raw) continue
      const descending = raw.startsWith('-')
      const path = descending ? raw.slice(1) : raw
      const cmp = compareValues(getPath(a, path), getPath(b, path))
      if (cmp !== 0) return descending ? -cmp : cmp
    }
    return 0
  })
}
