import { normalizeForDynamo } from './normalizeForDynamo.js'

export type UpdateExpressionParts = {
  UpdateExpression: string
  ExpressionAttributeNames: Record<string, string>
  ExpressionAttributeValues: Record<string, unknown>
}

/**
 * Build a DynamoDB `UpdateExpression` from a partial Payload patch (`data`).
 * Recurses one level into nested objects for group fields.
 */
export function buildUpdateExpression(
  data: Record<string, unknown>,
): UpdateExpressionParts | null {
  const sets: string[] = []
  const names: Record<string, string> = {}
  const values: Record<string, unknown> = {}
  let nameCounter = 0
  let valueCounter = 0

  const nameFor = (segment: string): string => {
    const existing = Object.entries(names).find(([, v]) => v === segment)?.[0]
    if (existing) return existing
    const key = `#n${nameCounter++}`
    names[key] = segment
    return key
  }

  const addSet = (path: string[], value: unknown): void => {
    const valueKey = `:v${valueCounter++}`
    values[valueKey] = normalizeForDynamo(value)
    const pathExpr = path.map((seg) => nameFor(seg)).join('.')
    sets.push(`${pathExpr} = ${valueKey}`)
  }

  const walk = (obj: Record<string, unknown>, prefix: string[]): void => {
    for (const [key, val] of Object.entries(obj)) {
      if (val === undefined) continue
      const path = [...prefix, key]
      if (
        val !== null &&
        typeof val === 'object' &&
        !Array.isArray(val) &&
        !(val instanceof Date)
      ) {
        walk(val as Record<string, unknown>, path)
      } else {
        addSet(path, val)
      }
    }
  }

  walk(data, [])
  if (sets.length === 0) return null

  return {
    UpdateExpression: `SET ${sets.join(', ')}`,
    ExpressionAttributeNames: names,
    ExpressionAttributeValues: values,
  }
}
