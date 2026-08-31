#!/usr/bin/env node
/**
 * Serves `dist/` the way a correctly configured static host would, so the build
 * can be proven before it is deployed anywhere. `node:http` only — a preview
 * server that needed a dependency could not be trusted to match the host.
 *
 * The one interesting rule is the fallback: `dist/` holds several SPAs (the site
 * at the root, one per demo under /demos/<name>/), so an unmatched path falls
 * back to the *nearest* index.html walking up the path — otherwise
 * /demos/printomato/devices would boot the portfolio shell. Every config in
 * deploy/ implements exactly this rule; this is the reference implementation.
 *
 *   node scripts/preview.mjs --port 4173 --host 127.0.0.1 --dir dist
 */

import { createReadStream, existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { createServer } from 'node:http'
import { extname, join, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('..', import.meta.url))
const argv = process.argv.slice(2)

function flag(name, short) {
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === `--${name}` || (short && argv[i] === `-${short}`)) return argv[i + 1]
    if (argv[i].startsWith(`--${name}=`)) return argv[i].slice(name.length + 3)
  }
  return undefined
}

const port = Number(flag('port', 'p') ?? process.env.PORT ?? 4173)
const host = flag('host') ?? '127.0.0.1'
const dir = resolve(root, flag('dir') ?? 'dist')

if (!Number.isInteger(port) || port < 1 || port > 65535) {
  console.error(`preview: --port must be a number between 1 and 65535, got "${flag('port', 'p')}"`)
  process.exit(1)
}
if (!existsSync(join(dir, 'index.html'))) {
  console.error(`preview: no index.html in ${dir} — run \`npm run build\` first.`)
  process.exit(1)
}

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
  '.mp4': 'video/mp4',
  '.wasm': 'application/wasm',
  '.zip': 'application/zip',
  '.pdf': 'application/pdf',
}

/**
 * A bundle built with VITE_BASE=/portfolio/ carries absolute asset URLs under
 * that prefix, so serving dist/ at "/" would 404 every script. Read the base
 * back out of index.html and mount the tree there — preview then reproduces the
 * deployed URL shape exactly, subpath and all.
 */
function detectBase() {
  const html = readFileSync(join(dir, 'index.html'), 'utf8')
  const match = html.match(/(?:src|href)="([^"]*)\/assets\//)
  const prefix = match?.[1] ?? ''
  return prefix.startsWith('/') ? `${prefix}/` : '/'
}

const base = detectBase()

function isFile(path) {
  try {
    return statSync(path).isFile()
  } catch {
    return false
  }
}

/** Keeps `..` and absolute paths from escaping dist/. */
function safeJoin(segments) {
  const target = resolve(dir, ...segments)
  return target === dir || target.startsWith(dir + sep) ? target : null
}

function send(req, res, path, status) {
  const type = MIME[extname(path).toLowerCase()] ?? 'application/octet-stream'
  const immutable = /(^|\/)assets\//.test(path.slice(dir.length).split(sep).join('/'))
  res.writeHead(status, {
    'Content-Type': type,
    'Content-Length': statSync(path).size,
    // Mirrors the caching the deploy configs set, so a stale index.html shows up
    // here rather than in production.
    'Cache-Control': immutable ? 'public, max-age=31536000, immutable' : 'no-cache',
  })
  if (req.method === 'HEAD') {
    res.end()
    return
  }
  createReadStream(path).pipe(res)
}

function text(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' })
  res.end(`${body}\n`)
}

const server = createServer((req, res) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    text(res, 405, 'Method not allowed')
    return
  }

  const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`)
  let pathname
  try {
    pathname = decodeURIComponent(url.pathname)
  } catch {
    text(res, 400, 'Malformed URL')
    return
  }

  let sub = pathname
  if (base !== '/') {
    if (pathname === base.slice(0, -1) || pathname === '/') {
      res.writeHead(302, { Location: base })
      res.end()
      return
    }
    if (!pathname.startsWith(base)) {
      console.log(`404 ${pathname}  (outside base ${base})`)
      text(res, 404, `Not found. This bundle is mounted at ${base}`)
      return
    }
    sub = `/${pathname.slice(base.length)}`
  }

  const segments = sub.split('/').filter((segment) => segment !== '' && segment !== '.')
  const target = safeJoin(segments)
  if (!target) {
    text(res, 403, 'Forbidden')
    return
  }

  if (isFile(target)) {
    send(req, res, target, 200)
    return
  }
  if (existsSync(target) && statSync(target).isDirectory()) {
    if (!pathname.endsWith('/')) {
      res.writeHead(301, { Location: `${pathname}/${url.search}` })
      res.end()
      return
    }
    const index = join(target, 'index.html')
    if (isFile(index)) {
      send(req, res, index, 200)
      return
    }
  }

  // A missing hashed asset is a broken build, not a client route — say so
  // instead of handing back HTML that the browser will fail to parse as JS.
  const ext = extname(sub).toLowerCase()
  if (ext && ext !== '.html') {
    console.log(`404 ${pathname}`)
    text(res, 404, 'Not found')
    return
  }

  for (let depth = segments.length; depth >= 0; depth -= 1) {
    const candidate = safeJoin([...segments.slice(0, depth), 'index.html'])
    if (candidate && isFile(candidate)) {
      console.log(`200 ${pathname}  →  ${candidate.slice(dir.length) || '/index.html'}`)
      send(req, res, candidate, 200)
      return
    }
  }

  console.log(`404 ${pathname}`)
  text(res, 404, 'Not found')
})

server.on('error', (error) => {
  if (error.code === 'EADDRINUSE') {
    console.error(`preview: port ${port} is in use — try \`npm run preview -- --port ${port + 1}\``)
  } else {
    console.error(`preview: ${error.message}`)
  }
  process.exit(1)
})

server.listen(port, host, () => {
  const origin = `http://${host}:${port}`
  const demosDir = join(dir, 'demos')
  const demos = existsSync(demosDir)
    ? readdirSync(demosDir, { withFileTypes: true })
        .filter((entry) => entry.isDirectory() && isFile(join(demosDir, entry.name, 'index.html')))
        .map((entry) => entry.name)
    : []

  const width = Math.max(4, ...demos.map((demo) => demo.length))
  console.log(`\nserving ${dir}  (base ${base})\n`)
  console.log(`  ${'site'.padEnd(width)}  ${origin}${base}`)
  for (const demo of demos) console.log(`  ${demo.padEnd(width)}  ${origin}${base}demos/${demo}/`)
  console.log('\nSPA fallback is on: unmatched paths resolve to the nearest index.html.')
  console.log('ctrl-c to stop.\n')
})
