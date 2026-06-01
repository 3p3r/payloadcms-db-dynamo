import { execSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { assertDbReachable } from '../__helpers/assertDbReachable.js'
import { resetExampleTables } from './reset-table.js'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')

export default async function globalSetup(): Promise<void> {
  await assertDbReachable()

  execSync('npm install --prefix examples/payload-3.x --no-audit --no-fund', {
    cwd: root,
    stdio: 'inherit',
  })
  execSync('npm install --prefix examples/payload-4.x --no-audit --no-fund', {
    cwd: root,
    stdio: 'inherit',
  })

  await resetExampleTables()
}
