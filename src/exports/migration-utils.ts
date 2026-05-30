import type { Payload } from 'payload'

export type MigrateUpArgs = {
  payload: Payload
  req: Parameters<Payload['create']>[0] extends { req?: infer R } ? R : never
  session?: unknown
}

export type MigrateDownArgs = MigrateUpArgs
