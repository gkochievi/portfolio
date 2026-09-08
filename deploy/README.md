# Deploying

`npm run build` produces one directory that any static host can serve:

```
dist/
├── index.html          the portfolio site (SPA)
├── 404.html            GitHub Pages redirector — bounces a deep link to the bundle that owns it
├── _redirects          Netlify / Cloudflare fallback rules
├── assets/…            content-hashed site bundle
└── demos/
    ├── gisheri/        the stone shop (one SPA, two surfaces: / and /admin/)
    ├── nabadi/         the barbershop (one SPA, two surfaces: / and /admin/)
    ├── tonnaro/        the transport platform (its own SPA)
    └── printomato/     the console (its own SPA)
        ├── index.html
        ├── 404.html    copy of the demo's index.html, for hosts with nearest-404 semantics
        ├── assets/…
        └── media/…
```

Two knobs, and only two:

| Env var | Default | What it does |
|---|---|---|
| `VITE_BASE` | `/` | The public path the site is served from. Baked into every asset URL and into the router's basename, so it must be set **at build time** and must match the deploy path exactly. Demos derive theirs: `<VITE_BASE>demos/<name>/`. |
| `VITE_ROUTER` | `browser` | `hash` switches both apps to `HashRouter`. The escape hatch for a host that cannot rewrite — see the last section. |

And one rule the host has to implement: **an unmatched path falls back to the
nearest `index.html` walking up the path.** `/work/printomato` → `/index.html`;
`/demos/printomato/devices` → `/demos/printomato/index.html`, *not* the site's.
Get that backwards and a deep link into a demo loads the portfolio shell.

`node scripts/preview.mjs` implements exactly that rule — check the build there
before pushing it anywhere.

| Host | `VITE_BASE` | Fallback comes from |
|---|---|---|
| GitHub Pages (project site) | `/<repo>/` | `404.html`, written by the build |
| GitHub Pages (user/org site) | `/` | `404.html` |
| Netlify | `/` | `deploy/_redirects` (copied into `dist/`) |
| Cloudflare Pages | `/` | `_redirects`, with per-demo lines (see below) |
| Vercel | `/` | `vercel.json` at the repo root (committed) |
| nginx / any VPS | `/` | `deploy/nginx.conf` |
| S3 + CloudFront | `/` | CloudFront Function (below) |
| Anything that cannot rewrite | whatever the path is | `VITE_ROUTER=hash` |

---

## GitHub Pages

`.github/workflows/deploy-pages.yml` already does this: it derives the base
path from the repository name (`/<repo>/` on a project site, `/` on an
`<owner>.github.io` repo — deliberately not trusting `configure-pages` output,
whose shape has changed across versions), builds, and uploads `dist/`. Enable it in **Settings → Pages → Source:
GitHub Actions**; until then the workflow deliberately no-ops.

By hand:

```bash
VITE_BASE=/portfolio/ npm run build
npx gh-pages -d dist   # or commit dist/ to the gh-pages branch
```

Pages has no rewrite engine and serves exactly **one** error document: the
`404.html` at the root of the published site (the copies inside each demo are
never consulted). The build therefore writes a small redirector there: it works
out which bundle owns the missed path, bounces to that bundle's `index.html`
with the deep path in `?p=`, and a snippet the build injects into every
`index.html` restores the path with `history.replaceState` before the router
boots. On any host with a real rewrite engine, `404.html` never serves and the
snippet stays inert. The build also writes `.nojekyll`, without which Jekyll
would drop `_redirects` and any underscore-prefixed asset on a branch-published
site.

## Netlify

`netlify.toml` at the repo root:

```toml
[build]
  command = "npm run build"
  publish = "dist"

[build.environment]
  NODE_VERSION = "20"
  VITE_BASE = "/"
```

`dist/_redirects` ships with the build, so nothing else is needed. The build
generates it with one explicit rule per discovered demo, above the catch-all:

```
/demos/gisheri/*      /demos/gisheri/index.html      200
/demos/nabadi/*       /demos/nabadi/index.html       200
/demos/printomato/*   /demos/printomato/index.html   200
/demos/tonnaro/*      /demos/tonnaro/index.html      200
/*                    /index.html                    200
```

Order matters, and the status must be `200` (a rewrite) rather than `301` — the
URL has to survive so the router can read it. Unforced rules only apply when no
real file matches, so hashed assets and photos still serve themselves.

## Cloudflare Pages

Build command `npm run build`, output directory `dist`, and
`VITE_BASE=/` in the environment. `_redirects` is picked up from the output
root, and the explicit per-demo lines are exactly what Cloudflare needs — it
does not expand `:placeholder` in a rewrite destination, which is why the build
writes the rules out one demo at a time rather than with a placeholder.

## Vercel

**`vercel.json` is already at the repo root, committed.** Vercel reads it only
from the project's Root Directory, so that is where it has to live;
`deploy/vercel.json` is a byte-identical copy kept as the annotated reference
next to the other hosts. Nothing to copy — connecting the repo is the whole job:

1. **Add New → Project → Import Git Repository**, and pick this repo.
2. **Root Directory:** leave it at `./`. Pointing it at `site/` would build the
   portal alone with no `/demos/*` — and `vercel.json` would not be read at all.
3. **Build & Output Settings:** leave Build Command, Output Directory and
   Install Command **blank**. `vercel.json` owns all three and takes precedence;
   a value typed there is a second source of truth.
4. **Environment variables: add none.** Specifically not `VITE_BASE` — it must
   stay unset so it defaults to `/`, which is what every rewrite in the file
   assumes. Copying `/<repo>/` out of the Pages workflow is the single easiest
   way to break this deploy: every asset URL and both router basenames would
   move under a subpath while the rewrites still point at `/index.html`.
5. **Node version:** set Settings → General → Node.js Version explicitly. Note
   that `engines.node` in `package.json` takes precedence when present, and it
   is a floating `>=20`.
6. Deploy, then hard-reload each of these rather than clicking through:
   `/`, `/work/<slug>`, `/demos/tonnaro/`, `/demos/tonnaro/app/orders`,
   `/demos/nabadi/` and `/demos/nabadi/admin/bookings`. Then
   `curl -sI <url>/assets/<hashed>.js` — `content-type: text/javascript` plus the
   immutable `cache-control` proves the filesystem-before-rewrite order and the
   header rules in one response.

Two details in that file are load-bearing and easy to "tidy" back into bugs:

- **The rewrite sources use `(.*)`, not `:path*`.** A repeated parameter cannot
  absorb a trailing slash: `/demos/:demo/:path*` does not match
  `/demos/nabadi/admin/`. The original config got away with it only because
  `trailingSlash: false` stripped the slash before matching — two mistakes
  cancelling out, so removing either one alone breaks trailing-slash URLs.
- **`trailingSlash` is deliberately absent.** Set to `false` it 308-redirects
  `/demos/nabadi/` — the exact string the portal cards link to — to
  `/demos/nabadi`. Setting it `true` would 308 every deep link the other way.
  Absent, Vercel serves both forms and the rules cover both: rewrite 1 handles
  the bare `/demos/<name>`, rewrite 2 the slashed and deep forms, so neither
  form depends on a normalising redirect existing.
- **The two SPA fallbacks exclude the asset directories**, via the lookaheads in
  their sources, and that is not tidiness. `headers` are matched against the
  **request** path in a phase that compiles *before* the filesystem check, so
  `/assets/<hash>.js` collects `immutable, max-age=31536000` whether or not the
  file exists. Without the exclusion, a browser holding a stale `index.html` and
  requesting a since-deleted chunk gets the portal's HTML back with `200` and a
  year-long immutable directive — the page dies on `Unexpected token '<'` and
  the poisoned URL is pinned in that browser's disk cache with no revalidation
  path. Excluded, the miss is a plain 404, which is what
  [`nginx.conf`](./nginx.conf) achieves with `try_files $uri =404` and what
  `preview.mjs` means by "a missing hashed asset is a broken build, not a client
  route". The third lookahead is load-bearing: with only the demo-scoped one,
  `/demos/nabadi/assets/gone.js` falls through to the root catch-all and is
  served `index.html` anyway.

Ordering is the rest of it: Vercel applies redirects, then the filesystem, then
rewrites top-to-bottom with first match winning. So the two `/demos/…` rules
must precede the catch-all — reverse them and every demo deep link boots the
portfolio shell — and the catch-all cannot shadow a real file, because hashed
assets are found by the filesystem first.

`dist/_redirects`, `dist/404.html` and `dist/.nojekyll` ride along in the output
and are inert here: Vercel never reads the first, and the other two are
unreachable through any linked URL under these rewrites.

## nginx / any VPS

```bash
VITE_BASE=/ npm run build
rsync -a --delete dist/ deploy@host:/srv/portfolio/dist/
```

Then `include` [`nginx.conf`](./nginx.conf) in the server block. The important
part is the demo-scoped fallback:

```nginx
location ~ ^/demos/(?<demo>[^/]+)/ {
    try_files $uri $uri/ /demos/$demo/index.html;
}

location / {
    try_files $uri $uri/ /index.html;
}
```

Caddy equivalent, if that is the server:

```caddy
portfolio.example.com {
    root * /srv/portfolio/dist
    file_server
    @demo path_regexp demo ^/demos/([^/]+)/
    handle @demo {
        try_files {path} {path}/ /demos/{re.demo.1}/index.html
    }
    handle {
        try_files {path} /index.html
    }
}
```

## S3 + CloudFront

The bucket's "error document" trick maps *every* miss to one `index.html`, which
breaks the per-demo fallback. Attach a CloudFront Function on **viewer request**
instead:

```js
function handler(event) {
  var request = event.request
  var uri = request.uri
  if (uri.endsWith('/')) {
    request.uri = uri + 'index.html'
  } else if (!uri.split('/').pop().includes('.')) {
    var demo = uri.match(/^\/demos\/([^/]+)\//)
    request.uri = demo ? '/demos/' + demo[1] + '/index.html' : '/index.html'
  }
  return request
}
```

Upload with the caching the other hosts get:

```bash
aws s3 sync dist/ s3://BUCKET/ --delete \
  --exclude '*.html' --cache-control 'public, max-age=31536000, immutable'
aws s3 sync dist/ s3://BUCKET/ --delete \
  --exclude '*' --include '*.html' --cache-control 'no-cache'
aws cloudfront create-invalidation --distribution-id DIST --paths '/*'
```

## A host that cannot rewrite at all

A plain file server, an S3 website endpoint with no function, a shared host, or
a folder someone drops into an existing CMS. Build with the hash router and the
path the bundle will actually live at:

```bash
VITE_BASE=/static/portfolio/ VITE_ROUTER=hash npm run build
```

Every route then lives after a `#` — `/static/portfolio/#/work/printomato`,
`/static/portfolio/demos/printomato/#/devices` — so the server only ever sees
the two real `index.html` requests and no fallback is needed. `VITE_BASE` is
still required: it is what makes the asset URLs resolve.

## Checklist before you ship

```bash
npm run typecheck
VITE_BASE=/ npm run build
npm run preview          # serves dist/ with the fallback rule above
```

Then click through both apps: reload on a deep link (`/work/printomato`,
`/demos/printomato/devices`), and confirm the console shows no 404s for
`assets/` or `media/`. A missing asset there is a `VITE_BASE` mismatch, not a
fallback problem.
