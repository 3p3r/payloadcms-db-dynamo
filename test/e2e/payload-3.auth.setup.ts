import fs from 'node:fs'
import path from 'node:path'

import { test as setup } from '@playwright/test'

import { authStatePath } from './auth-path.js'
import { registerFirstAdminUser } from './helpers.js'

const authFile = authStatePath('payload-3')

setup('authenticate admin', async ({ page }) => {
  fs.mkdirSync(path.dirname(authFile), { recursive: true })
  await registerFirstAdminUser(page, `admin-payload-3-${Date.now()}@example.com`)
  await page.context().storageState({ path: authFile })
})
