import type { Field, SanitizedCollectionConfig } from 'payload'

function fieldName(field: Field): string | undefined {
  return 'name' in field ? field.name : undefined
}

export function collectPointFields(fields: Field[]): string[] {
  const paths: string[] = []
  walkFields(fields, '', (path) => {
    paths.push(path)
  }, 'point')
  return paths
}

/** Index paths declared on the collection (unique / compound indexes). */
export function collectDeclaredIndexPaths(config: SanitizedCollectionConfig): string[] {
  const paths = new Set<string>()
  for (const idx of config.sanitizedIndexes ?? []) {
    for (const field of idx.fields) {
      if (typeof field === 'string') {
        paths.add(field)
      } else if ('name' in field && typeof field.name === 'string') {
        paths.add(field.name)
      } else if ('path' in field && typeof field.path === 'string') {
        paths.add(field.path)
      }
    }
  }
  return [...paths]
}

export function collectIndexPaths(config: SanitizedCollectionConfig): string[] {
  const paths = new Set(collectDeclaredIndexPaths(config))
  walkFields(config.fields, '', (path) => {
    paths.add(path)
  })
  return [...paths]
}

function walkFields(
  fields: Field[],
  prefix: string,
  visit: (path: string) => void,
  onlyType?: Field['type'],
): void {
  for (const field of fields) {
    const name = fieldName(field)
    if (!name) continue
    const path = prefix ? `${prefix}.${name}` : name
    if (onlyType && field.type !== onlyType) {
      if (field.type === 'group' && 'fields' in field && field.fields) {
        walkFields(field.fields, path, visit, onlyType)
      }
      continue
    }
    if (!onlyType || field.type === onlyType) {
      visit(path)
    }
    if (field.type === 'group' && 'fields' in field && field.fields) {
      walkFields(field.fields, path, visit, onlyType)
    }
  }
}
