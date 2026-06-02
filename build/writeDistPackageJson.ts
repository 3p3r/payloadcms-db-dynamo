import { copyFileSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const distDir = path.join(root, 'dist')

type RootPackageJson = {
  name: string
  version: string
  description: string
  license: string
  type: string
  keywords?: string[]
  engines?: Record<string, string>
  repository?: unknown
  bugs?: unknown
  homepage?: string
  publishConfig?: Record<string, string>
  peerDependencies?: Record<string, string>
  dependencies?: Record<string, string>
}

const rootPkg = JSON.parse(
  readFileSync(path.join(root, 'package.json'), 'utf8'),
) as RootPackageJson

const distPkg = {
  name: rootPkg.name,
  version: rootPkg.version,
  description: rootPkg.description,
  license: rootPkg.license,
  type: rootPkg.type,
  main: './index.js',
  types: './index.d.ts',
  exports: {
    '.': {
      import: './index.js',
      types: './index.d.ts',
    },
  },
  ...(rootPkg.keywords !== undefined ? { keywords: rootPkg.keywords } : {}),
  ...(rootPkg.engines !== undefined ? { engines: rootPkg.engines } : {}),
  ...(rootPkg.repository !== undefined ? { repository: rootPkg.repository } : {}),
  ...(rootPkg.bugs !== undefined ? { bugs: rootPkg.bugs } : {}),
  ...(rootPkg.homepage !== undefined ? { homepage: rootPkg.homepage } : {}),
  ...(rootPkg.publishConfig !== undefined ? { publishConfig: rootPkg.publishConfig } : {}),
  ...(rootPkg.peerDependencies !== undefined
    ? { peerDependencies: rootPkg.peerDependencies }
    : {}),
  ...(rootPkg.dependencies !== undefined ? { dependencies: rootPkg.dependencies } : {}),
}

writeFileSync(path.join(distDir, 'package.json'), `${JSON.stringify(distPkg, null, 2)}\n`)
copyFileSync(path.join(root, 'README.md'), path.join(distDir, 'README.md'))
copyFileSync(path.join(root, 'LICENSE'), path.join(distDir, 'LICENSE'))
