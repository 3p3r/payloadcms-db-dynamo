import type { SanitizedCollectionConfig } from 'payload'

export function normalizeSearchText(value: unknown): string {
  if (value === null || value === undefined) return ''
  const raw = typeof value === 'string' ? value : String(value)
  return raw.toLowerCase().replace(/\s+/g, ' ').trim()
}

export function searchNgrams(text: string, n: number): string[] {
  const normalized = normalizeSearchText(text)
  if (normalized.length < n) return []
  const grams = new Set<string>()
  for (let i = 0; i <= normalized.length - n; i++) {
    grams.add(normalized.slice(i, i + n))
  }
  return [...grams]
}

export function collectSearchIndexPaths(config: SanitizedCollectionConfig): string[] {
  const admin = config.admin
  if (admin && 'searchIndex' in admin && admin.searchIndex === false) {
    return []
  }

  const paths = new Set<string>()
  for (const field of admin?.listSearchableFields ?? []) {
    paths.add(field)
  }
  const useAsTitle = admin?.useAsTitle
  if (typeof useAsTitle === 'string' && useAsTitle.length > 0) {
    paths.add(useAsTitle)
  }
  return [...paths]
}
