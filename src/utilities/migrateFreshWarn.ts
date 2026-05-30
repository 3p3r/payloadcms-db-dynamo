/** Whether migrateFresh should log its destructive-action warning. */
export function shouldWarnMigrateFresh(forceAcceptWarning: boolean): boolean {
  return !forceAcceptWarning && process.env.NODE_ENV !== 'test'
}
