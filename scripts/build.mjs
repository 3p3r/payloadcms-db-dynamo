import * as esbuild from 'esbuild'
import { readdir } from 'node:fs/promises'
import { join } from 'node:path'

const entryPoints = await collectTsFiles('src')

await esbuild.build({
  entryPoints,
  outdir: 'dist',
  outbase: 'src',
  bundle: false,
  platform: 'node',
  format: 'esm',
  target: 'node20',
  sourcemap: true,
  logLevel: 'info',
})

async function collectTsFiles(dir) {
  const out = []
  for (const name of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, name.name)
    if (name.isDirectory()) {
      out.push(...(await collectTsFiles(path)))
    } else if (name.name.endsWith('.ts') && !name.name.endsWith('.d.ts')) {
      out.push(path)
    }
  }
  return out
}
