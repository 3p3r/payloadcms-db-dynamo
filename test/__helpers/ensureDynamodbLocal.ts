import { execSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { assertDbReachable, probeDynamoOnce, TEST_DDB_ENDPOINT } from './assertDbReachable.js'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')

if ((await probeDynamoOnce()) === true) {
  console.log(`DynamoDB already reachable at ${TEST_DDB_ENDPOINT}, skipping docker`)
  process.exit(0)
}

console.log(`Starting DynamoDB Local via docker compose (${TEST_DDB_ENDPOINT})`)
execSync('npm run docker:start', { cwd: root, stdio: 'inherit' })
await assertDbReachable()
