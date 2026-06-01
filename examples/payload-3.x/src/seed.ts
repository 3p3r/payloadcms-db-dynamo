import { getPayload } from 'payload'

import config from './payload.config'
import { seedCredentials, seedKitchenSink } from '../../shared/seed.js'

const run = async (): Promise<void> => {
  const payload = await getPayload({ config })
  await seedKitchenSink(payload)
  payload.logger.info(
    `Seed complete. Login: ${seedCredentials.email} / ${seedCredentials.password}`,
  )
  await payload.destroy()
  process.exit(0)
}

void run()
