import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { initPayloadTest, type TestHandle } from '../__helpers/initPayload.js'
import { config } from './config.js'

let handle: TestHandle

beforeAll(async () => {
  handle = await initPayloadTest('transactions', config)
})

afterAll(async () => {
  await handle?.cleanup()
})

describe('Payload transactions', () => {
  it('commit persists buffered writes', async () => {
    const tx = await handle.payload.db.beginTransaction()
    expect(tx).toBeTruthy()

    await handle.payload.create({
      collection: 'items',
      data: { title: 'committed' },
      req: { transactionID: tx } as never,
    })

    await handle.payload.db.commitTransaction(tx!)

    const found = await handle.payload.find({
      collection: 'items',
      where: { title: { equals: 'committed' } },
    })
    expect(found.totalDocs).toBe(1)
  })

  it('rollback discards buffered writes', async () => {
    const tx = await handle.payload.db.beginTransaction()
    await handle.payload.create({
      collection: 'items',
      data: { title: 'rolled-back' },
      req: { transactionID: tx } as never,
    })
    await handle.payload.db.rollbackTransaction(tx!)

    const found = await handle.payload.find({
      collection: 'items',
      where: { title: { equals: 'rolled-back' } },
    })
    expect(found.totalDocs).toBe(0)
  })

  it('create then login in one transaction (registerFirstUser shape)', async () => {
    const tx = await handle.payload.db.beginTransaction()
    const email = `first-${Date.now()}@example.com`
    await handle.payload.create({
      collection: 'users',
      data: { email, password: 'test-password-123' },
      overrideAccess: true,
      req: { transactionID: tx } as never,
    })
    const login = await handle.payload.login({
      collection: 'users',
      data: { email, password: 'test-password-123' },
      req: { transactionID: tx } as never,
    })
    await handle.payload.db.commitTransaction(tx!)
    expect(login.token).toBeTruthy()
  })

  it('auth user create in a transaction (Put + Update on same item)', async () => {
    const tx = await handle.payload.db.beginTransaction()
    const created = await handle.payload.create({
      collection: 'users',
      data: {
        email: `tx-user-${Date.now()}@example.com`,
        password: 'test-password-123',
      },
      req: { transactionID: tx } as never,
    })
    await handle.payload.db.commitTransaction(tx!)

    expect(created.email).toContain('@example.com')
    const login = await handle.payload.login({
      collection: 'users',
      data: {
        email: created.email,
        password: 'test-password-123',
      },
    })
    expect(login.token).toBeTruthy()
  })

  it('read-your-writes inside an open transaction', async () => {
    const tx = await handle.payload.db.beginTransaction()
    const created = await handle.payload.create({
      collection: 'items',
      data: { title: 'in-tx' },
      req: { transactionID: tx } as never,
    })

    const found = await handle.payload.db.findOne({
      collection: 'items',
      where: { id: { equals: created.id } },
      req: { transactionID: tx } as never,
    })
    expect(found?.title).toBe('in-tx')

    await handle.payload.db.rollbackTransaction(tx!)
  })

})
