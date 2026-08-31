# Adding a project

Two things exist per project: a **demo bundle** under `demos/<name>/`, and an **entry** in
`site/content/projects.json`. Everything else is discovery. This is the whole runbook.

A project without a demo is also fine — skip to step 4 and set `demoUrl` to `null`.

## 1. Create the demo workspace

The fastest correct start is to copy Printomato's config files, because they already encode the
house rules:

```bash
mkdir -p demos/kioskmap/src
cp demos/printomato/tsconfig.json demos/kioskmap/
cp demos/printomato/vite.config.ts demos/kioskmap/
cp demos/printomato/index.html demos/kioskmap/
```

Then change exactly four things:

| Where | To |
|---|---|
| `package.json` → `name` | `@demos/kioskmap` — the `@demos/` scope is how the root scripts address it |
| `vite.config.ts` → `base` default | `/demos/kioskmap/` — must match the folder name |
| `vite.config.ts` → `server.port` | An unused port. `strictPort` is on: 5173 is the site, 5174 is Printomato |
| `index.html` | Title, description, favicon — and drop a `public/favicon.png` beside it. It loads `/src/main.tsx`, so write that too |

A minimal `demos/kioskmap/package.json`:

```json
{
  "name": "@demos/kioskmap",
  "private": true,
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b --noEmit && vite build",
    "typecheck": "tsc -b --noEmit"
  },
  "dependencies": { "@portfolio/brand": "*" }
}
```

Then list what the app actually imports — `vite`, `typescript`, `@vitejs/plugin-react`,
`tailwindcss`, `@tailwindcss/vite`, `react`, `react-dom` and so on. npm hoists, so a demo that
omits them still builds locally off another workspace's copies; the manifest is just wrong, and
it will be wrong somewhere less convenient later. Matching Printomato's versions keeps the
lockfile from growing.

Three requirements. Only the first is enforced by the build:

- `npm run build` in that folder must leave an `index.html` in `demos/<name>/dist/`. Anything
  else fails the whole build with the path it looked at.
- `base` must come from `process.env.VITE_BASE`, with the `/demos/<name>/` default as a
  fallback — the build passes the real one in, and a bundle that ignores it has broken asset
  URLs the moment the site is deployed under a subpath.
- If the app routes, it has to honour `VITE_ROUTER=hash` the same way both existing apps do.
  A site on the hash router next to a demo on the browser router 404s on every deep link.

## 2. Re-install

```bash
npm install
```

npm resolves workspaces off the filesystem, so scripts run in the new folder immediately and
anything already in the tree — vite, react, `@portfolio/brand` — resolves from the hoisted root
`node_modules`. What the install buys you is the **lockfile**: `npm ci` is what CI, Netlify and
Vercel run, and it refuses outright when `package.json` and `package-lock.json` disagree. Any
dependency the new demo actually adds is only there after this too.

## 3. Respect the two rules that make this repo work

Both are load-bearing, not stylistic:

- **No backend and no network at runtime.** Seed data compiles into the bundle; an in-browser
  mock serves it. The demo has to work offline, in an iframe, on a dumb static host.
- **Session-only state.** No `localStorage`, `sessionStorage` or IndexedDB for demo data. A
  reload restores the pristine seed, so every visitor gets an identical, un-vandalised demo.

Anything two projects share goes in `packages/brand` or `scripts/`, never inside a demo. Media
goes in `demos/<name>/public/` and is addressed through `import.meta.env.BASE_URL`, never as an
absolute path. `demos/printomato/README.md` describes one way to build the mock layer.

## 4. Add the catalogue entry

Append an object to the array in `site/content/projects.json`. Order in the file is order on the
page; the first entry is the featured card and the one the hero's buttons point at.

```jsonc
{
  // ── the eight the portal renders ──────────────────────────────────────
  "slug": "kioskmap",                        // React key + seed for the card artwork
  "name": "Kioskmap",                        // card title
  "tagline": "One line. This is the card's body copy — make it count.",
  "period": "2025 — 2026",
  "status": "shipped",                       // shipped | live | in-progress | archived
  "stack": ["Django 5", "React 18"],         // first five show, the rest collapse to +N
  "demoUrl": "/demos/kioskmap/",             // base-relative; null makes the card unclickable
  "cover": null,                             // card image, base-relative; null draws the generated mark

  // ── kept, but nothing renders these today ─────────────────────────────
  "summary": "Two or three sentences.",
  "role": "What you owned.",
  "highlights": ["…"],
  "metrics": [{ "label": "Tests", "value": "96" }],
  "problem": "Prose. Blank lines split paragraphs.",
  "approach": "Prose.",
  "architecture": [{ "layer": "Kiosk", "detail": "…" }],
  "results": ["…"],
  "demoNote": "What the demo is and is not.",
  "sourceUrl": null,
  "screenshots": [
    { "title": "Map", "caption": "What this screen does.", "schematic": "dashboard", "src": null }
  ]
}
```

The comments above are for this page; the real file is strict JSON. Field-by-field notes are in
[`site/README.md`](../site/README.md).

The portal renders only eight of these — `slug`, `name`, `tagline`, `period`, `status`, `stack`,
`demoUrl` and `cover`. The rest is kept because it is expensive to write and a detail view may return,
but nothing reads it: a typo in `problem` or `screenshots` costs nothing, while a wrong
`demoUrl` costs everything. And **nothing validates this file** — `content.ts` asserts it into
`Project[]`, so a missing key survives `npm run typecheck`. Open `/` and click the new card
before you call it done.

## 5. Verify

```bash
npm run typecheck
npm run build        # the summary table must list demos/kioskmap with the right base
npm run preview      # it prints a URL per demo
```

Then click: the new card on `/`, which must land on the demo; a reload on a deep link inside it
(`/demos/kioskmap/<some-route>` must boot the demo, not the portal); and the demo's console for
404s on `assets/` or media.

## What the build does for you

| | |
|---|---|
| Discovery | Any directory in `demos/` with a `package.json` is built. Nothing lists them. |
| Base path | `VITE_BASE=<site base>demos/<name>/`, and `VITE_ROUTER` is passed through. |
| Assembly | Output copied to `dist/demos/<name>/`. |
| SPA fallback | The root `404.html` redirector and the generated `dist/_redirects` both pick the new demo up from discovery; `deploy/vercel.json` and `deploy/nginx.conf` match `/demos/:demo/*` generically. |
| Preview | `scripts/preview.mjs` enumerates `dist/demos/` and serves each with the nearest-`index.html` rule. |
| The portal | The whole grid renders from the JSON, and the card is the link. Nothing else has to be touched. |

## What it does not

| | |
|---|---|
| `npm install` | Not needed to run the new workspace locally, but required before pushing: `npm ci` fails on a lockfile that does not match (step 2). |
| A root `dev:<name>` script | Add one to the root `package.json` beside `dev:printomato`, or run `npm --workspace @demos/kioskmap run dev`. |
| The dev port | `strictPort` is on and nothing allocates for you. |
| The catalogue entry | Nothing scans `demos/`. A demo with no entry is deployed and unreachable from the site. |
| Cloudflare Pages | It does not expand `:demo` in a rewrite destination — add an explicit `/demos/kioskmap/* → /demos/kioskmap/index.html 200` line above the catch-all. Every other host in `deploy/` is generic. |
| Card artwork | `ProjectMark` generates a constellation seeded from the slug, so a new project gets its own for free. A real image would be a code change. |
| Any check on the JSON | See step 4. |
