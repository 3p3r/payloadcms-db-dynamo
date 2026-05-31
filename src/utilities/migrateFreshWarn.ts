import type { DynamoAdapter } from '../types.js'

/** Whether migrateFresh should log its destructive-action warning. */
export function shouldWarnMigrateFresh(
  adapter: DynamoAdapter,
  forceAcceptWarning: boolean,
): boolean {
  return !forceAcceptWarning && adapter.config.warnOnMigrateFresh
}
