#!/usr/bin/env node
/**
 * Removes every build output and incremental-compile cache. Node instead of
 * `rm -rf` + shell globs, for the same reason build-all.mjs special-cases
 * Windows: the rest of the toolchain works there, so clean has to as well.
 */

import { existsSync, readdirSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('..', import.meta.url))

const targets = [join(root, 'dist'), join(root, 'site', 'dist'), join(root, 'site', 'tsconfig.tsbuildinfo')]

const demosDir = join(root, 'demos')
if (existsSync(demosDir)) {
  for (const entry of readdirSync(demosDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue
    targets.push(join(demosDir, entry.name, 'dist'))
    for (const file of readdirSync(join(demosDir, entry.name))) {
      if (file.endsWith('.tsbuildinfo')) targets.push(join(demosDir, entry.name, file))
    }
  }
}

for (const target of targets) {
  if (!existsSync(target)) continue
  rmSync(target, { recursive: true, force: true })
  console.log(`removed ${target.slice(root.length)}`)
}
