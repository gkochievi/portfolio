# Azri (აზრი) — live demo

A white-label customer-feedback service that people reach by SMS, running with its backend cut off.

After a branch visit, a call or a car service, the business texts the customer a personal,
one-time link. It opens a mobile-first page that checks the token, shows the campaign and three to
five questions rated 1-5 on star controls, takes an optional comment, submits once and says
thank you. After that the link is spent; an unknown, used or expired link gets its own end screen.
Every business (tenant) has its own monogram, colours, SMS sender ID and copyright line.

Azri is a **fictional brand**. The product it presents is a real one Boulder built; everything that
identifies the original client — names, wordmark, colours, hostnames, copy — has been replaced. The
name is the Georgian word for *opinion*; the five tenants (Nergi Bank, Elva Telecom, Borbali Auto
Service, Kalakuri Clinic, Puri da Chai) are invented, and every address, phone number and short
link uses a reserved or masked form (`azri.example`, `+995 5•• ••• 451`).

Here the same flow talks to an in-browser mock of the survey API — seed JSON compiled into the
build, an in-memory store, and a router that answers the same calls with the same envelopes. No
server, no database, and no network request of any kind.

| | |
|---|---|
| **The inbox** | `/demos/azri/` — six recipient personas, each with SMS messages from the tenants and a live status per link, a "try every branch" strip, and the five tenants as chips |
| **The survey** | `/survey?id=…` — validate, intro, star ratings, comment, submit; `/finished`, `/expired`, `/invalid` and a 404 as the end states |
| **The playground** | `/playground` — the three survey calls with editable request JSON, the response, status and latency, an endpoint list, and a demo clock |
| **The console** | `/console` — overview, responses, campaigns, the SMS dispatch log, send survey SMS, and a branch member's own scores |

The demo opens **on the SMS inbox, signed in as Mariam**, because the text message is the product's
real front door. The bar in the corner switches accounts in one click — nobody can guess
credentials that live in a seed file. The same three accounts also sign in through the real login
form (`/login`), with the password below.

| Role | Name | Email | Password | Lands on |
|---|---|---|---|---|
| **Respondent** | Mariam Lomidze (მარიამ ლომიძე) | `mariam@azri.example` | `azri-demo` | `/` — her inbox, two pending links on top |
| **Admin** (CX manager) | Nino Gelashvili (ნინო გელაშვილი) | `nino@azri.example` | `azri-demo` | `/console` — every tenant, branch, result and comment |
| **Agent** (branch staff) | Levan Japaridze (ლევან ჯაფარიძე) | `levan@azri.example` | `azri-demo` | `/console/me` — his own scores, plus the send-SMS form for his branch |

Signed out, the public screens (inbox, survey, playground, end states) all still work: the
respondent's identity in the product is the token in the link, not a login. `/console/**` needs an
admin or an agent; a respondent or a signed-out visitor is sent to `/login?next=…`, and the wrong
console role is sent to its own home.

It **opens in English**; the `ENG / ქარ` pill is on every screen and switches the whole app,
console included. `?lang=ka` on first load opens it in Georgian. Dark mode follows the operating
system.

## Try this

1. In Mariam's inbox, open the Nergi Bank text (the Vake branch, served by Levan) and rate the
   questions. Submit. The link flips to *completed* in the inbox; open it again and it lands on
   "already answered".
2. Open the other end states from the "try every branch" strip: already answered, expired, an
   unknown id, and a link with no id at all.
3. Switch to **Nino** in the bar. The response you just sent is at the top of the overview's
   comment feed and the responses list, tagged *just now*, and the SMS log shows the spent token.
4. Switch to **Levan**, open **Send survey SMS**, pick a demo persona and send. About a second
   later the text lands in that persona's inbox, with a toast.
5. In the playground, press **+7 days** on the demo clock. Every pending token expires, everywhere.
6. Open the demo in two tabs — the inbox in one, the console in the other — and answer a survey in
   the first.

## Running it

| Command | |
|---|---|
| `npm run dev:azri` | Vite dev server at <http://localhost:5184/demos/azri/> |
| `npm --workspace @demos/azri run build` | `tsc -b --noEmit`, then `vite build` into `demos/azri/dist/` |
| `npm --workspace @demos/azri run typecheck` | TypeScript strict |
| `node demos/azri/scripts/generate-seed.mjs` | Regenerates `src/demo/seed/*.json` (deterministic, no dependencies) |
| `npm run build` (repo root) | Builds the site and every demo into the deployable `dist/` |

Run all of them from the repo root; the workspace is installed by the root `npm install`.
`VITE_BASE` (default `/demos/azri/`) and `VITE_ROUTER=hash` are the two build-time knobs — see the
[root README](../../README.md). The bundle works in an iframe and under any sub-path; every in-app
link goes through the router, never a root-absolute `href`.

## What works

- **The whole respondent flow**, with the product's mechanics intact: the entry redirect
  (`/?id=…` becomes `/survey?id=…`, every query parameter carried across), a validation spinner,
  five-point star ratings you can raise but never clear back to zero, one comment box, a single
  submit, and the three end states. Unrated questions are sent as `null` and an all-empty submit is
  allowed — the form is permissive, and a soft "you skipped 2 questions" hint is the only
  addition. A second tap on Send does nothing while the first is in flight.
- **White-label theming.** The validation response carries the tenant's branding, and the page
  re-skins itself from it: monogram, primary colour, tint, copyright line. Five tenants, five
  different looks, one component tree.
- **One-time tokens with live status.** Submitting writes a response to the store and flips the
  link to completed; the inbox badge, the console and the dispatch log all update without a reload.
- **Expiry.** A pending link past its `expiresAt` on the demo clock is expired, both when validated
  and when listed. A sweeper flips stored links every 30 seconds and on every clock change.
- **Other customers keep answering.** Every 40-70 seconds a background respondent completes one
  pending link with a generated response, a positive skew and, three times in ten, a comment.
  Persona links are never touched, so the inbox never changes under you.
- **The API playground**, from the original's small developer test page: three calls
  (validate, get questions, submit), an editable `survey_id` and request body, the pretty-printed
  response with per-line hover, HTTP status, latency, and copy buttons.
- **The demo clock.** +1 day, +7 days and reset, moving `clock.now()` for every handler and
  simulator.
- **The console**: KPIs (CSAT, average, response rate, responses today) with deltas against the
  previous window, a daily trend, a 1-5 distribution, per-tenant or per-branch breakdown, per-question
  averages, a paginated responses feed with fuzzy search and a detail drawer, campaign cards and
  detail pages, and the dispatch log with status tabs and filters.
- **Send survey SMS.** A react-hook-form + zod form, a live SMS preview in the chosen language, and
  server-side validation that mirrors the form. An agent is forced to their own branch and name,
  whatever the request says.
- **Two tabs, one demo.** A `BroadcastChannel` (`azri-demo`) relays live changes between open tabs.
  It stores nothing.
- **Bilingual, to the last string.** English and Georgian are both complete — 594 keys in seven
  namespaces — and Georgian uses the formal register. Survey content, seed copy and the SMS bodies
  exist in both languages; customer comments are single-language and shown verbatim, never
  translated.

## What is deliberately switched off

| | |
|---|---|
| Real SMS delivery | There is no gateway. A "sent" text is an entry in the store that appears in a persona's inbox ~1.2 s later. A free phone number (`5XX 00 00 XX`) has no inbox, so its link shows in the log only. |
| Token issuance, campaign authoring, expiry policy, reporting | All of it lived in the upstream CRM, not in the survey front end. The console is a **simulated CRM view** and is labelled that way in its top bar; campaign settings are read-only, marked "Managed in the CRM". |
| Authentication as a security property | The password is compared in plain text against a seed row. There is no session and nothing to forge — the "server" is a function call in the same tab. |
| Persistence of any kind | Reload is the reset. No `localStorage`, `sessionStorage` or IndexedDB; the language and the demo clock reset with the page. That is a product decision, not a missing feature, and the inbox footer says so. |
| Topic chips on the comment box | Not a feature of the original, so not built. A comment is a textarea and a 500-character counter. |
| The legacy test-page payload `{rate, question_id}` | The form posts `{id, question_rate}`; the playground notes the older shape and accepts only the form's. |
| The proxy layer, Docker and nginx | The static bundle replaces all three. |
| Network, fonts and images from elsewhere | Every font is bundled; every illustration is inline SVG. |

## The seam

```
pages/ + components/          the UI. Calls hooks and nothing else.
        │   useQuery(['launcher', 'messages', id]) · useMutation(submit)
        ▼
features/*/api.ts             one file per group: typed wrappers and query keys
        │   request('POST', '/surveys/validate', { body })
        ▼
lib/api.ts                    request() — the one place that would have been fetch().
        │                     DemoApiError in, ApiError out; the UI never sees the mock
        ▼
demo/core.ts                  createMockApi: route table, path captures, simulated latency
        │                     (reads 120-320 ms, writes 350-800 ms), the auth gate
        ▼
demo/handlers/                meta · auth · survey · launcher · insights · campaigns · staff
        │   analytics.ts holds the selectors every screen shares, so no two agree to disagree
        ▼
demo/core.ts · store          createStore: a structuredClone of the seed, held for the tab's life
```

The demo is built on `@portfolio/demo-kit`, which supplies the pieces that are the same in every
demo: `createMockApi` (the router and its latency), `createStore` (the in-memory tables,
`nextId`, `reset`), `createSession` (who the visitor is pretending to be), `createEventBus`,
`createRandom` (a seeded PRNG), `rebaseDates`, `every()` (a timer that pauses while the tab is
hidden), `DemoBar` and `createDemoRouter`. Azri adds the survey domain on top.

**Failure crosses the seam unchanged.** A handler throws `DemoApiError`; `lib/api.ts` re-dresses it
as the `ApiError` the UI already understands, with `fieldErrors` landing under the right input. The
three survey calls keep the original's convention instead: **HTTP 200 with
`{success: false, message}`**, and the page branches on the message — a string containing
"expired" goes to `/expired`, "already completed" to the answered screen, anything else to
`/invalid`. A request that cannot even be parsed (no `survey_id`) is a 400.

**Realtime is an event bus, not a websocket.** Handlers and simulators emit
(`response:created`, `link:updated`, `sms:received`, `clock:changed`, `store:reset`);
`lib/realtime.ts` turns each into a query invalidation for every scope **except `survey`** — a
re-validate of a just-submitted token would bounce the respondent to "already answered".

**Time is injected.** Anything that decides expiry, "today" or a window reads `clock.now()`, never
`new Date()`, which is what makes the playground's time travel honest. Seed timestamps are
authored relative to `2026-10-01T09:00Z` and rebased to the moment the tab boots, so pending links
are always a few days from expiry and "today" always has responses.

## The original architecture

The product is small on purpose. Its public write-up:

| Layer | What it was |
|---|---|
| **SMS** | The business's CRM sends a text containing a personal one-time link, `https://<host>/?id=<token>`. Dispatch, token issuance, expiry rules and result storage all live there. |
| **Microsite** | Next.js 15 (App Router) on React 19 RC, Tailwind CSS 3.4 and DaisyUI 4 with one custom theme, Noto Sans Georgian through `next/font`. Every page is a client component and state is plain `useState`: no state library and no i18n library. About 700 lines across 24 files. |
| **BFF proxy** | Three route handlers forward JSON to the CRM's REST API — validate, submit, get questions — relay the status and body unchanged, disable caching and log both sides. Added to get around browser CORS: the first build called the CRM directly from the browser. |
| **Upstream** | The CRM's REST API, one subdomain per tenant. Not in the repository. |
| **Deployment, v1** | A static export: a multi-stage Docker build (`node:20-alpine`, then `nginx:alpine`) serving the output on 80/443 with mounted TLS certificates, an SPA fallback, gzip, security headers (`X-Frame-Options`, `nosniff`, HSTS) and one-year immutable caching on static assets. Route handlers cannot run in a static export, which is why v2 exists. |
| **Deployment, v2** | Next server mode, with docker-compose running two services: the app on 3000 and an nginx reverse proxy on 80. |
| **Multi-tenancy** | One deployment per client: a config module (company name, API base URL, endpoint paths), a swapped logo and icon, and the theme's primary colour. |

The flow: **SMS → microsite → validate → questions → answers → thank-you, expired or
already-done.** The demo replaces everything right of the SMS with a Vite + React SPA over an
in-browser mock, and replaces "one deployment per client" with a theme read from the token's
tenant.

## The data

`demo/seed/*.json` holds raw rows — not API payloads. `scripts/generate-seed.mjs` writes them
deterministically (a seeded PRNG, so a re-run is byte-identical). Full field lists are in
[`src/demo/schema.md`](src/demo/schema.md).

| Table | Rows |
|---|---|
| `tenants` | 5 — a bank, a telecom, a car service, a clinic and a café chain, each with its own palette and SMS sender |
| `branches` | 10 across Tbilisi and Batumi |
| `staff` | 16, one of whom (Levan) can sign in |
| `campaigns` | 6, with link lifetimes of 7 days (3 for the café) |
| `questions` | 21, with numeric ids in the original's style (1101, 1102 …) |
| `recipients` | 6 personas, masked phones only |
| `links` | 286 over 45 days — 156 completed, 92 expired, 38 pending; 11 belong to the personas, 275 to background customers |
| `messages` | 13 SMS in the persona inboxes — 11 valid, one with an unknown token, one with no id |
| `responses` | 156 — 554 answers, 52 of them skipped; mean 4.23, skewed positive; 60 comments, 42 of them Georgian |
| comment pools | 119 customer comments by sentiment band, for the live simulator |

Each branch has a personality, so the filters show differences: one shop's waiting time sits near
3.4, one clinic's waiting area near 3.6, and Levan averages about 4.6 over 27 responses.

## Layout

```
src/
  main.tsx · router.ts · routes.tsx    boot, the demo-kit router, the route table
  types.ts                             shared entity and wire types
  demo/
    core.ts                            store, session, mock API, event bus, demo clock, guards, tokens
    analytics.ts                       shared selectors: scope, KPIs, trend, distribution, row mappers
    session.ts · sync.ts · index.ts    role homes · the two-tab mirror · boot
    seed/                              generated JSON, accounts, comment pools
    handlers/                          meta · auth · survey · launcher · insights · campaigns · staff
    simulators/                        insights (background respondents) · campaigns (expiry) · staff (SMS timers)
    schema.md · routes.md              the entities and the endpoints, documented
  features/
    survey/        launcher/           the respondent microsite · the inbox and the playground
    insights/      campaigns/          overview and responses · campaigns and the dispatch log
    staff/                             my scores and send survey SMS
                                       each: pages/ components/ api.ts types.ts locales/{en,ka}
  components/
    ui/                                the design system: tokens, controls, charts, illustrations
    layout/                            site, respondent and console shells, the demo bar
    brand/                             the mark and the wordmark
  i18n/ · lib/ · hooks/ · styles/      language setup, api client, formatting, theme tokens
scripts/generate-seed.mjs              the deterministic seed generator
```

First load is about 380 KB gzipped (JS plus CSS) including the seed and the chart chunk; every
page is a lazy chunk. The built bundle is 2.4 MB, fonts included.
