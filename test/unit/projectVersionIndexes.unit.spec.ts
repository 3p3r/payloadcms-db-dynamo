import { describe, expect, it } from 'vitest'

import {
  projectVersionIndexes,
  projectVersionLatestPointerDelete,
  resolveVersionDocKeys,
} from '../../src/index/projectVersionIndexes.js'
import { mockAdapter } from '../__helpers/mockAdapter.js'

describe('projectVersionIndexes', () => {
  it('projects latest pointer and parent gsi1 on version row', () => {
    const projection = projectVersionIndexes({
      collectionSlug: 'posts',
      versionsPartition: 'posts_versions',
      versionId: 'v1',
      parentId: 'p1',
      updatedAt: '2024-01-01T00:00:00.000Z',
      latest: true,
      beforeLatest: false,
    })
    expect(projection.mainAttributes.gsi1pk).toBe('VER#posts#PARENT#p1')
    expect(projection.puts).toHaveLength(1)
    expect(projection.puts[0]?.entityType).toBe('ver-latest')
    expect(projection.puts[0]?.gsi1pk).toBe('COL#posts#VER#LATEST')
  })

  it('writes only parent gsi1 when not latest', () => {
    const projection = projectVersionIndexes({
      collectionSlug: 'posts',
      versionsPartition: 'posts_versions',
      versionId: 'v1',
      parentId: 'p1',
      updatedAt: '2024-01-01T00:00:00.000Z',
      latest: false,
      beforeLatest: false,
    })
    expect(projection.puts).toHaveLength(0)
    expect(projection.deletes).toHaveLength(0)
    expect(projection.mainAttributes.gsi1pk).toBe('VER#posts#PARENT#p1')
  })

  it('deletes latest pointer when demoting', () => {
    const projection = projectVersionIndexes({
      collectionSlug: 'posts',
      versionsPartition: 'posts_versions',
      versionId: 'v1',
      parentId: 'p1',
      updatedAt: '2024-01-01T00:00:00.000Z',
      latest: false,
      beforeLatest: true,
    })
    expect(projection.puts).toHaveLength(0)
    expect(projection.deletes).toHaveLength(1)
  })

  it('builds pointer delete key and resolves doc keys', () => {
    const adapter = mockAdapter({
      resolveVersionsPartition: (s: string) => `${s}_versions`,
    })
    expect(projectVersionLatestPointerDelete('posts', 'v1')).toEqual({
      pk: 'COL#posts#VER#LATEST',
      sk: 'REF#v1',
    })
    expect(resolveVersionDocKeys(adapter, 'posts', { id: 'v1' })).toEqual({
      pk: 'posts_versions',
      sk: 'v1',
    })
  })
})
