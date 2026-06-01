import fs from 'node:fs'
import path from 'node:path'

import { test as setup } from '@playwright/test'

import { authStatePath } from './auth-path.js'
import { registerFirstAdminUser } from './helpers.js'

const authFile = authStatePath('payload-4')
const nodeMajor = Number(process.versions.node.split('.')[0] ?? 0)

setup.skip(nodeMajor < 24, 'Payload 4.x example requires Node.js >= 24 (see examples/payload-4.x/package.json)')

setup('authenticate admin', async ({ page }) => {
  fs.mkdirSync(path.dirname(authFile), { recursive: true })
  await registerFirstAdminUser(page, `admin-payload-4-${Date.now()}@example.com`)
  await page.context().storageState({ path: authFile })
})
