import type { Connect } from 'payload'

import type { DynamoAdapter } from './types.js'

import { ensureConnected } from './utilities/ensureConnected.js'

export const connect: Connect = async function (this: DynamoAdapter) {
  ensureConnected(this)
}
