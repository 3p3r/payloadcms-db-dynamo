import type { Destroy } from 'payload'

import type { DynamoAdapter } from './types.js'

export const destroy: Destroy = async function (this: DynamoAdapter) {
  this.docClient?.destroy()
  if (this.ownsClient) {
    this.client?.destroy()
  }
  this.docClient = undefined
  this.client = undefined
}
