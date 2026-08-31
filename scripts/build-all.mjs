#!/usr/bin/env node
/**
 * Builds every workspace and assembles them into one deployable `dist/`.
 *
 * `VITE_BASE` is the only knob. It has to be baked in at build time because Vite
 * rewrites asset URLs against it and React Router reads it back through
 * `import.meta.env.BASE_URL` — so a bundle compiled for `/` cannot be moved to
 * `/portfolio/` afterwards. Set it to the public path the site will be served
 * from; demos get `<base>demos/<name>/` derived from it.
 *
 * Demos are discovered, never listed: dropping a second folder into `demos/`
 * with a package.json is enough to get it built, mounted and SPA-fallback'd.
 *
 *   VITE_BASE=/            node scripts/build-all.mjs   # domain root
 *   VITE_BASE=/portfolio/  node scripts/build-all.mjs   # GitHub Pages project site
 *   VITE_ROUTER=hash       node scripts/build-all.mjs   # host cannot rewrite at all
 */

import { spawnSync } from 'node:child_process'
import {
  copyFileSync,
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('..', import.meta.url))
const distDir = join(root, 'dist')
const demosDir = join(root, 'demos')

// Node 24 refuses to spawn a .cmd shim without a shell.
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm'
const useShell = process.platform === 'win32'

function fail(message) {
  console.error(`\nbuild failed: ${message}\n`)
  process.exit(1)
}

/** Both slashes matter — Vite concatenates `base` with asset paths verbatim. */
function normalizeBase(value) {
  let base = String(value ?? '').trim()
  if (base === '') return '/'
  if (!base.startsWith('/') && !/^https?:\/\//.test(base)) base = `/${base}`
  if (!base.endsWith('/')) base += '/'
  return base
}

function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`
  const units = ['KB', 'MB', 'GB']
  let value = bytes / 1024
  let unit = 0
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024
    unit += 1
  }
  return `${value.toFixed(value >= 100 ? 0 : 1)} ${units[unit]}`
}

function walk(dir) {
  let files = 0
  let bytes = 0
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) {
      const nested = walk(path)
      files += nested.files
      bytes += nested.bytes
    } else if (entry.isFile()) {
      files += 1
      bytes += statSync(path).size
    }
  }
  return { files, bytes }
}

function discoverDemos() {
  if (!existsSync(demosDir)) return []
  return readdirSync(demosDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && existsSync(join(demosDir, entry.name, 'package.json')))
    .map((entry) => entry.name)
    .sort()
}

function build(target) {
  const started = Date.now()
  console.log(`\n── ${target.label}  →  base ${target.base}\n`)

  const result = spawnSync(npm, ['run', 'build'], {
    cwd: target.dir,
    stdio: 'inherit',
    shell: useShell,
    env: { ...process.env, VITE_BASE: target.base, VITE_ROUTER: router },
  })

  if (result.error) fail(`${target.label}: ${result.error.message}`)
  if (result.status !== 0) {
    fail(`${target.label}: \`npm run build\` exited with ${result.signal ?? result.status}`)
  }

  const out = join(target.dir, 'dist')
  if (!existsSync(join(out, 'index.html'))) {
    fail(`${target.label}: no index.html in ${relative(root, out)} — did the build write elsewhere?`)
  }

  target.out = out
  target.seconds = (Date.now() - started) / 1000
}

const router = process.env.VITE_ROUTER ?? 'browser'
const siteBase = normalizeBase(process.env.VITE_BASE ?? '/')

const siteDir = join(root, 'site')
if (!existsSync(join(siteDir, 'package.json'))) fail('site/package.json is missing')

const targets = [
  { label: 'site', dir: siteDir, base: siteBase, mount: '.' },
  ...discoverDemos().map((name) => ({
    label: `demos/${name}`,
    dir: join(demosDir, name),
    base: `${siteBase}demos/${name}/`,
    mount: join('demos', name),
  })),
]

console.log(`portfolio build — base ${siteBase}, ${router} router, ${targets.length} bundle(s)`)
for (const target of targets) build(target)

// Assemble: site at the root, each demo under its own directory.
rmSync(distDir, { recursive: true, force: true })
mkdirSync(distDir, { recursive: true })
for (const target of targets) {
  const dest = target.mount === '.' ? distDir : join(distDir, target.mount)
  mkdirSync(dest, { recursive: true })
  cpSync(target.out, dest, { recursive: true })
}

// GitHub Pages has no rewrite engine and serves exactly one error document:
// the 404.html at the root of the published site. A 404.html inside
// demos/<name>/ is never consulted, so a plain copy of the site's index.html
// at the root would boot the portfolio shell — and its not-found page — for a
// deep link like /demos/printomato/devices. Instead, the root 404.html is a
// redirector: it works out which bundle owns the path, bounces to that
// bundle's index.html with the deep path packed into ?p=, and the restore
// snippet injected into every index.html below puts the path back with
// history.replaceState before the router boots. Hosts with a real rewrite
// engine (everything in deploy/) never serve 404.html at all, and the snippet
// is inert without the parameter.

const RESTORE_SNIPPET = `    <script>
      /* Restores a deep link packed into ?p= by the root 404.html redirector
         (GitHub Pages fallback — see scripts/build-all.mjs). Inert unless the
         parameter is present. */
      ;(function () {
        var q = new URLSearchParams(location.search)
        var p = q.get('p')
        if (p === null) return
        q.delete('p')
        var rest = q.toString()
        var sep = p.indexOf('?') === -1 ? '?' : '&'
        history.replaceState(
          null,
          '',
          location.pathname.replace(/\\/?$/, '/') + p + (rest ? sep + rest : '') + location.hash,
        )
      })()
    </script>
  </head>`

function redirector(base, demos) {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="robots" content="noindex" />
    <title>Redirecting…</title>
    <script>
      /* GitHub Pages serves this file for every unmatched path on the whole
         site. Find the bundle the path belongs to, then bounce to that
         bundle's index.html with the deep path in ?p= — the index.html
         restores it. Written by scripts/build-all.mjs. */
      ;(function () {
        var base = ${JSON.stringify(base)}
        var demos = ${JSON.stringify(demos)}
        var l = location
        if (l.pathname.indexOf(base) !== 0) {
          l.replace(base)
          return
        }
        var rest = l.pathname.slice(base.length)
        var match = rest.match(/^demos\\/([^/]+)\\//)
        var bundle = match && demos.indexOf(match[1]) !== -1 ? base + match[0] : base
        var deep = l.pathname.slice(bundle.length) + l.search + l.hash
        l.replace(bundle + (deep ? '?p=' + encodeURIComponent(deep) : ''))
      })()
    </script>
  </head>
  <body>
    <p>Redirecting… <a href="${base}">Continue to the site</a>.</p>
  </body>
</html>
`
}

const extras = []
for (const target of targets) {
  const dir = target.mount === '.' ? distDir : join(distDir, target.mount)
  const index = join(dir, 'index.html')
  const html = readFileSync(index, 'utf8')
  if (!html.includes('</head>')) fail(`${target.label}: index.html has no </head> to inject into`)
  writeFileSync(index, html.replace('</head>', RESTORE_SNIPPET))
  if (target.mount !== '.') {
    // Per-demo copies cost nothing and cover hosts with nearest-404 semantics;
    // GitHub Pages ignores them and uses the root redirector below.
    copyFileSync(index, join(dir, '404.html'))
    extras.push(join(relative(root, dir), '404.html'))
  }
}

writeFileSync(
  join(distDir, '404.html'),
  redirector(siteBase, targets.filter((target) => target.mount !== '.').map((target) => target.label.replace('demos/', ''))),
)
extras.unshift('dist/404.html')

// Netlify / Cloudflare Pages fallback. Generated rather than copied from
// deploy/_redirects, because Cloudflare does not expand :placeholders in a
// rewrite destination — it needs one explicit line per demo, and the build is
// the one thing that always knows the demo list. deploy/_redirects stays as
// the annotated reference.
const demoNames = targets.filter((target) => target.mount !== '.').map((target) => target.label.replace('demos/', ''))
writeFileSync(
  join(distDir, '_redirects'),
  [
    '# Generated by scripts/build-all.mjs — SPA fallbacks for Netlify and Cloudflare Pages.',
    '# A rewrite (status 200) only fires when no real file matches, so hashed assets',
    '# and media still serve themselves. Demo rules must precede the catch-all.',
    ...demoNames.map((name) => `${siteBase}demos/${name}/*   ${siteBase}demos/${name}/index.html   200`),
    `${siteBase}*   ${siteBase}index.html   200`,
    '',
  ].join('\n'),
)
extras.push('dist/_redirects')

// Jekyll runs on branch-published Pages sites and drops `_`-prefixed paths,
// which would eat _redirects. Costs a byte; saves a confusing afternoon.
writeFileSync(join(distDir, '.nojekyll'), '')
extras.push('dist/.nojekyll')

// Measured at the source, not the destination: the site's mount is the dist
// root, so measuring there would credit it with every demo's photos.
const rows = targets.map((target) => {
  const { files, bytes } = walk(target.out)
  return {
    bundle: target.label,
    base: target.base,
    files: String(files),
    size: formatSize(bytes),
    time: `${target.seconds.toFixed(1)}s`,
  }
})

const columns = [
  { key: 'bundle', head: 'bundle' },
  { key: 'base', head: 'compiled for' },
  { key: 'files', head: 'files', right: true },
  { key: 'size', head: 'size', right: true },
  { key: 'time', head: 'built in', right: true },
]
const widths = columns.map((column) =>
  Math.max(column.head.length, ...rows.map((row) => row[column.key].length)),
)
const line = (cells) =>
  cells
    .map((cell, index) => (columns[index].right ? cell.padStart(widths[index]) : cell.padEnd(widths[index])))
    .join('  ')
    .trimEnd()

const total = walk(distDir)
console.log(`\n${line(columns.map((column) => column.head))}`)
console.log(widths.map((width) => '─'.repeat(width)).join('  '))
for (const row of rows) console.log(line(columns.map((column) => row[column.key])))
console.log(`\ndist/  ${total.files} files, ${formatSize(total.bytes)} total`)
console.log(`fallbacks  ${extras.join('  ')}`)
console.log(`\nverify it: npm run preview${siteBase === '/' ? '' : `   (mounts at ${siteBase})`}`)
