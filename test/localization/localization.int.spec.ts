import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { initPayloadTest, type TestHandle } from '../__helpers/initPayload.js'
import { config } from './config.js'

let handle: TestHandle

beforeAll(async () => {
  handle = await initPayloadTest('localization', config)
})

afterAll(async () => {
  await handle?.cleanup()
})

describe('localization', () => {
  it('persists and reads localized field maps', async () => {
    const doc = await handle.payload.create({
      collection: 'pages',
      data: { title: 'Hello' },
      locale: 'en',
    })

    await handle.payload.update({
      collection: 'pages',
      id: doc.id,
      data: { title: 'Bonjour' },
      locale: 'fr',
    })

    const en = await handle.payload.findByID({
      collection: 'pages',
      id: doc.id,
      locale: 'en',
    })
    const fr = await handle.payload.findByID({
      collection: 'pages',
      id: doc.id,
      locale: 'fr',
    })

    expect(en.title).toBe('Hello')
    expect(fr.title).toBe('Bonjour')
  })
})
