# Portfolio

A business portfolio site and the live product demos it links to — one npm workspace, one
`dist/`, and **no backend anywhere**.

Every demo is a complete front end whose API is an in-browser mock: JSON seed data compiled
into the bundle, served out of an in-memory store. No server, no database, no API call at
runtime, so a demo runs inside an iframe and on any static host. (The one network exception,
disclosed on its card: Tonnaro fetches map tiles.) Nothing is persisted either — a reload
restores the pristine seed, and every visitor gets the same un-vandalised data.

Eleven demos, all real products ported here so a visitor can click through them. The portal is
Boulder's and wears Boulder's brand (a port of boulder.ge, in English and Georgian).

The first four:
**Tonnaro**, a specialised-transport ordering platform (public site, customer app and dispatch
console, in three languages); **Nabadi**, a barbershop booking platform whose customer site and
staff console share one bundle and one store, so a booking made on the site turns up in the
console; **Printomato**, a fleet console for photo-printing kiosks; and **Gisheri**, a
natural-stone jewellery shop that is bilingual down to its content model, with a storefront and
an admin console over the one catalogue.

The next seven are shown **under fictional Georgian names and fresh visual identities**, so they
read as products rather than as any client's design — no client name, brand or data is in them:
**Tova**, a 60-second booth game for live events with an organiser console; **Bani**, a voice
operations console (call records across two phone platforms, recordings, agents, campaigns,
extensions, platform health); **Rigi**, a back office for a software vendor (partners, licences,
invoicing, a support desk and a partner portal); **Sinji**, an AI call-quality platform
(transcripts, fact-checking, scorecards, a knowledge base, a copilot); **Dareke**, an outbound
call centre with a dialer, an agent workspace and a live supervisor wall; **Chiti**,
an omnichannel support chat (website widget, operator inbox, bot-to-human handover, admin and
platform consoles); and **Azri**, an SMS customer-feedback survey with an inbox simulator.

```
portfolio/
├── site/                      the portal — a grid, and a page per project     → site/README.md
├── demos/
│   ├── tonnaro/               transport platform, Django swapped for src/demo/ → demos/tonnaro/README.md
│   ├── nabadi/                barbershop booking: two apps, one bundle, one store → demos/nabadi/README.md
│   ├── printomato/            the fleet console, Django swapped for src/demo/ → demos/printomato/README.md
│   ├── gisheri/               the stone shop: two surfaces, one bilingual catalogue → demos/gisheri/README.md
│   ├── tova/ bani/ rigi/      the seven fictional-brand demos: each its own front end over a mock API
│   └── sinji/ dareke/ chiti/ azri/                                            → demos/<name>/README.md
├── packages/demo-kit/         the shared seam of the seven: mock API, in-memory store, session, "Live demo" bar
├── packages/brand/            tokens.css and logo assets (today only the Printomato demo imports it)
├── scripts/
│   ├── build-all.mjs          builds site + every demo into dist/
│   └── preview.mjs            serves dist/ with SPA fallback (node:http only, no deps)
├── vercel.json                Vercel's copy of the fallback rules — it reads only the repo root
├── deploy/                    per-host fallback configs                       → deploy/README.md
├── docs/adding-a-project.md   the runbook for the next one
└── .spec/PLAN.md              the spec this was built against
```

## Quick start

```bash
npm install               # one install for every workspace, hoisted to the root
npm run dev:site          # http://localhost:5173/
npm run dev:printomato    # http://localhost:5174/demos/printomato/
npm run dev:tonnaro       # http://localhost:5175/demos/tonnaro/
npm run dev:nabadi        # http://localhost:5176/demos/nabadi/
npm run dev:gisheri       # http://localhost:5177/demos/gisheri/
npm run dev:tova          # http://localhost:5178/demos/tova/
npm run dev:bani          # http://localhost:5179/demos/bani/
npm run dev:rigi          # http://localhost:5180/demos/rigi/
npm run dev:sinji         # http://localhost:5181/demos/sinji/
npm run dev:dareke        # http://localhost:5182/demos/dareke/
npm run dev:chiti         # http://localhost:5183/demos/chiti/
npm run dev:azri          # http://localhost:5184/demos/azri/
```

The seven fictional-brand demos all behave the same way. A **Live demo** bar sits bottom-left
(built by Boulder, deliberately outside each demo's own palette): it lists one demo account per
role and signs you in with a click, resets the data, and links back to the portfolio. The login
page offers the same accounts as cards. `?lang=ka` on the first load opens Georgian, which is
what the portal passes along from its Georgian pages. Each demo's README lists its accounts and
describes the original product's architecture.

The console demo opens already signed in. Signing out reveals the real login page with the
demo account pre-filled — `demo` / `printomato-demo`.

Tonnaro opens signed out, on its public marketing site. The banner in the corner signs you in
as a customer or as a dispatcher — `demo@tonnaro.ge` and `admin@tonnaro.ge`, both on
`tonnaro-demo`.

Gisheri opens signed out, on the shop front, in English — the switch in the header puts the
whole thing, console included, into Georgian, which is what it does upstream. The banner signs
you in as a customer or as an administrator — `demo@gisheri.ge` and `admin@gisheri.ge`, both on
`gisheri-demo`.

```bash
npm run typecheck         # tsc -b --noEmit, strict, in every TypeScript workspace (Tonnaro is JS)
npm run build             # → dist/ : site at the root, demos under dist/demos/<name>/
npm run preview           # serve dist/ the way a correct host would, on :4173
npm run clean
```

`npm install && npm run typecheck && npm run build && npm run preview` is the whole
verification story, and it works from a cold clone.

## The two deploy knobs

Both are read at **build time**. A bundle compiled for one base cannot be moved to another
afterwards: Vite bakes the base into every asset URL, and React Router reads it back for its
basename.

| Env var | Default | What it does |
|---|---|---|
| `VITE_BASE` | `/` | The public path the site is served from. Demos derive theirs: `<VITE_BASE>demos/<name>/`. |
| `VITE_ROUTER` | `browser` | `hash` puts every route behind a `#` in **both** the site and the demos — the zero-config escape hatch for a host that cannot rewrite. |

```bash
VITE_BASE=/portfolio/ npm run build     # GitHub Pages project site
VITE_ROUTER=hash npm run build          # host cannot serve index.html for unknown paths
```

The one rule a host has to implement is the SPA fallback, and it is **per bundle**: an
unmatched path falls back to the *nearest* `index.html` walking up the path, so
`/demos/printomato/devices` boots the console rather than the portfolio shell. Get it backwards
and every deep link into a demo lands on the site. `scripts/preview.mjs` is the reference
implementation — check a build there before pushing it anywhere.

| Host | `VITE_BASE` | Fallback comes from |
|---|---|---|
| GitHub Pages (project site) | `/<repo>/` | the redirector `404.html` the build writes at the root — Pages serves only that one error document, so it bounces a deep link to the owning bundle, which restores the path |
| Netlify | `/` | `dist/_redirects`, generated by the build |
| Cloudflare Pages | `/` | the same `_redirects` — the build writes one explicit line per demo |
| Vercel | `/` | `vercel.json`, committed at the repo root |
| nginx / any VPS | `/` | `deploy/nginx.conf` |
| S3 + CloudFront | `/` | a CloudFront viewer-request function |
| Anything that cannot rewrite | whatever the path is | `VITE_ROUTER=hash` |

Full instructions, including the GitHub Actions workflow in `.github/workflows/`, are in
[`deploy/README.md`](./deploy/README.md).

## Where to read next

| | |
|---|---|
| [`demos/tonnaro/README.md`](./demos/tonnaro/README.md) | How the transport platform was ported off Django, and how the brand was made fictional: the seam, the 128-route mock, the deterministic route synthesiser. |
| [`demos/nabadi/README.md`](./demos/nabadi/README.md) | How two separate front ends were merged into one bundle over one store: the scoped `@/` alias, the availability engine, the 93-route mock. |
| [`demos/printomato/README.md`](./demos/printomato/README.md) | How the console was ported off Django: the seam, the mock API, the in-memory store, what is deliberately not reproduced. |
| [`demos/gisheri/README.md`](./demos/gisheri/README.md) | How the shop was ported off Django and given a fictional brand: the seam, the 64-route mock, the two-layer Georgian catalogue, and the one place the mock is kinder than the backend. |
| [`demos/<name>/README.md`](./demos) for `tova`, `bani`, `rigi`, `sinji`, `dareke`, `chiti`, `azri` | Per demo: its accounts, what works and what is deliberately switched off, the original product's architecture, and `src/demo/schema.md` / `routes.md` — every entity and every mocked endpoint. |
| [`packages/demo-kit/README.md`](./packages/demo-kit/README.md) | The shared seam: `createMockApi`, `createStore`, `createSession`, the event bus and clock helpers, the `DemoBar`. |
| [`site/README.md`](./site/README.md) | The portal: Boulder brand tokens, the Georgian/English routes and content overlay, the content model, and which fields it actually renders. |
| [`docs/adding-a-project.md`](./docs/adding-a-project.md) | Adding project #2: what to create, what the build finds by itself, what it does not. |
| [`deploy/README.md`](./deploy/README.md) | One section per host. |

## Contact

[poke@boulder.ge](mailto:poke@boulder.ge) — Boulder, Tbilisi ([boulder.ge](https://boulder.ge))
