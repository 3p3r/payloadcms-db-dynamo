import type { TransactWriteCommandInput } from '@aws-sdk/lib-dynamodb'

export type DynamoTransactionSession = {
  id: string
  transactItems: NonNullable<TransactWriteCommandInput['TransactItems']>
  overlay: Map<string, Record<string, unknown>>
  deleted: Set<string>
}

export function itemKey(pk: string, sk: string): string {
  return `${pk}\0${sk}`
}
