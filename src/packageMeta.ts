/** Published npm package name (`payloadcms-db-dynamo`). */
export const PACKAGE_NAME = 'payloadcms-db-dynamo' as const

export const DOC_CLIENT_REQUIRED = 'docClient is not initialized — call connect() first.' as const

export function adapterError(message: string): Error {
  return new Error(`${PACKAGE_NAME}: ${message}`)
}
