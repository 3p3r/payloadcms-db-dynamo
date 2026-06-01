import path from 'node:path'
import { fileURLToPath } from 'node:url'

const suiteDir = path.dirname(fileURLToPath(import.meta.url))

export function authStatePath(projectName: 'payload-3' | 'payload-4'): string {
  return path.join(suiteDir, '.auth', `${projectName}.json`)
}
