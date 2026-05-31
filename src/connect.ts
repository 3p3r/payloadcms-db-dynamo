import type { Connect } from 'payload'

import { log } from './log.js'
import type { DynamoAdapter } from './types.js'

import { ensureConnected } from './utilities/ensureConnected.js'

const connectLog = log('connect')

export const connect: Connect = async function (this: DynamoAdapter) {
  connectLog('connect')
  ensureConnected(this)
}
