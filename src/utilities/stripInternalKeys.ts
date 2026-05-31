import omit from 'lodash/omit.js'

/**
 * Drop the adapter's internal `pk`/`sk` attributes from a row before it
 * crosses the boundary back into Payload land. Callers see clean documents
 * keyed by the user-facing `id`; the composite-key plumbing stays internal.
 */
export function stripInternalKeys(item: Record<string, unknown>): Record<string, unknown> {
  return omit(item, ['pk', 'sk'])
}
