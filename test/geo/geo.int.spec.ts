import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { initPayloadTest, type TestHandle } from '../__helpers/initPayload.js'
import { config } from './config.js'

let handle: TestHandle

beforeAll(async () => {
  handle = await initPayloadTest('geo', config)
})

afterAll(async () => {
  await handle?.cleanup()
})

describe('geo operators', () => {
  beforeAll(async () => {
    await handle.payload.create({
      collection: 'places',
      data: { name: 'SF', location: [-122.4194, 37.7749] },
    })
    await handle.payload.create({
      collection: 'places',
      data: { name: 'LA', location: [-118.2437, 34.0522] },
    })
    await handle.payload.create({
      collection: 'places',
      data: { name: 'NYC', location: [-74.006, 40.7128] },
    })
  })

  it('near returns places within radius sorted by distance', async () => {
    const result = await handle.payload.find({
      collection: 'places',
      where: {
        location: {
          near: [-122.4194, 37.7749, 500000],
        },
      },
      sort: 'location',
      limit: 10,
    })
    expect(result.docs.length).toBeGreaterThan(0)
    expect(result.docs[0]?.name).toBe('SF')
  })

  it('near inside and with name filter uses geo-index path', async () => {
    const result = await handle.payload.find({
      collection: 'places',
      where: {
        and: [
          { location: { near: [-122.4194, 37.7749, 500000] } },
          { name: { equals: 'SF' } },
        ],
      },
      limit: 10,
    })
    expect(result.totalDocs).toBe(1)
    expect(result.docs[0]?.name).toBe('SF')
  })

  it('within matches points inside polygon', async () => {
    const result = await handle.payload.find({
      collection: 'places',
      where: {
        location: {
          within: {
            type: 'Polygon',
            coordinates: [
              [
                [-123, 38],
                [-121, 38],
                [-121, 37],
                [-123, 37],
                [-123, 38],
              ],
            ],
          },
        },
      },
    })
    const names = result.docs.map((d) => d.name)
    expect(names).toContain('SF')
    expect(names).not.toContain('NYC')
  })
})
