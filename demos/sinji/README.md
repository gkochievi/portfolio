# Sinji — live demo

An AI call-quality platform for Georgian-first support teams, running with its backend cut off.

Sinji (სინჯი: a sample taken to test the fineness of a metal, and the verb for examining something) is a fictional Georgian
brand for a multi-tenant product Boulder built. A call recording or a pasted transcript becomes a diarised
transcript, a fact-check against the team's own knowledge base, a two-sided read of tone (what the words say, what the voice
says) and a weighted rubric scorecard, all drawn on one audio timeline. Around that sit a knowledge-base manager with AI
curation, a grounded support bot with an agent copilot that streams drafts, public voice tools (speech synthesis,
transcription, a file converter and a browser audio editor), and an operator console with AI-usage and server-health reporting.

Upstream it is a Next.js front end over a Python API, a Postgres database with vector search, and a handful of model
services. Here the same screens talk to an in-browser mock of that API: seed data compiled into the bundle, an in-memory
store, and a router that answers the same paths with the same payload shapes. No server, no database, no model, and no
network request of any kind.

The demo opens **signed out**, on the public voice tools page, because that is the product's real front door. Sign in from the
top bar or the banner in the corner. The language switch sits in the top bar too, and `?lang=ka` on the first load opens Georgian.

## Accounts

One shared password for all four: **`sinji-demo`**. The sign-in page pre-fills Tamar and shows the other three as one-click cards.

| Role | Name | Email | Lands on | Sees |
|---|---|---|---|---|
| Operator | Levan Kipiani | `levan@sinji.example` | `/console/tenants` | Everything: the console, AI setup, usage, and any workspace (act-as, Mtiebi Bank by default) |
| Workspace owner | Tamar Gelashvili, head of QA | `tamar@sinji.example` | `/workspace/calls/rec_mtb_01` | Mtiebi Bank in full: calls, knowledge base, rubric, curation, bot, settings |
| Workspace member | Nino Kurtanidze, QA reviewer | `nino@sinji.example` | `/workspace/calls` | The same workspace, settings read-only (writes answer 403 and show a read-only note) |
| Agent (a member) | Saba Lomidze, contact-centre agent | `saba@sinji.example` | `/copilot` | The copilot and autopilot harness |

The five fictional workspaces besides the first are the operator's to explore: Pari Insurance, Iasamani Clinic, Darbazi Telecom,
Nobati (delivery) and Mzetamze Hotels (deactivated).

## Running it

| Command | |
|---|---|
| `npm run dev:sinji` | Vite dev server at <http://localhost:5181/demos/sinji/> |
| `npm --workspace @demos/sinji run build` | `tsc -b --noEmit`, then `vite build` into `demos/sinji/dist/` |
| `npm --workspace @demos/sinji run typecheck` | TypeScript strict |
| `npm run build` (repo root) | Builds the site and every demo into the deployable `dist/` |

Run all of them from the repo root. `VITE_BASE` (default `/demos/sinji/`) and `VITE_ROUTER=hash` are the two build-time knobs, so the
bundle works in an iframe, under a sub-path, and on a host with no SPA fallback — see the [root README](../../README.md).

## What works

Everything below is a real screen answering from the mock, and writes are real against the in-memory copy.

- **Public voice tools** (`/`, guests and every role): speech synthesis in Georgian, English and Russian with a voice list, model choice and advanced
  settings; quick transcription (Recorder or a sample); the two-sided sentiment read; the bulk converter with queued, converting, done and failed rows and a ZIP built in
  the tab; a daily allowance that counts down and refuses. `/editor` is a Web Audio editor: waveform, cut, trim, silence, reverse, fades, gain, normalise, layers, undo/redo, WAV export.
- **Calls workbench** (`/workspace/calls`): the call table, an upload queue with per-file transcription overrides, pasted-transcript analysis, and the call detail page — a player with
  waveform and a sentiment ribbon, finding lanes per rubric dimension, a transcript with inline claim marks (supported, contradicted, not in the knowledge base), and four analysers
  (fact-check, score, tone, summary) that run on their own or "all at once".
- **Analysis**: scorecard with an animated gauge, manual score edits with a required note and a revision history; tone with the text-versus-voice agreement banner; multi-call digests.
- **Knowledge base** (eight sub-tabs): overview, documents with filters and bulk actions, import (files, pasted text, question/answer CSV, AI restructure), chunks, a retrieval playground with
  confidence, duplicates, activity, maintenance (export, full re-embed job); plus the **KB health** curation queue with word-level diffs, accept, accept with edits, decline and bulk accept.
- **Workspace settings**: the rubric editor (weights, measured dimensions, normalise, AI import from a document, reset), score bands, sentiment, transcription (inheritance shown), own AI keys, the bot.
- **Copilot and autopilot** (`/copilot`): customer chat as the visitor, tier-by-tier stage timings, grounding verdicts, streamed drafts with citations, handoff, refusal of internal documents.
- **Operator console** (twelve tabs): workspaces and their users, server health with live charts, registered users, AI providers, integrations (chat credentials with a key diagnoser), embeddings,
  default rubric, default bot, bot kill switch, voices, anonymous limits, retention. Plus **AI setup** per workspace and **AI usage** (overview, recordings, bot conversations, calls, drill-downs).

## Deliberately switched off

| | |
|---|---|
| The model calls (speech-to-text, analysis, scoring, tone, embeddings, speech synthesis) | Every result is precomputed, or computed in the tab by small pure functions: TF-IDF retrieval for the knowledge base, the scoring formula, a word-level diff, a hash that picks the canned call closest to an upload. |
| The vector index and the voice-emotion model | Retrieval is lexical with light Georgian stemming; voice tone is part of each canned call. |
| Real transcription of what you say or upload | The Recorder really records (a microphone prompt appears) but the transcript is canned. An uploaded audio file is cloned from the closest canned call and relabelled. |
| Speech synthesis | "Synthesize" plays a pre-recorded clip in the chosen voice, and says so. |
| The personal account area and registration | The product has them; the portfolio demo has no persona for them. Registered users exist as data in the console. |
| The partner REST API | Documented upstream, not a screen. |
| The Russian UI | Russian remains a content, speech and bot language. The interface is English and Georgian. |
| Authentication as a security property | The password is compared in plain text against a seed row. The "server" is a function call in the same tab. |
| Persistence of any kind | Reload is the reset. That is a product decision, not a missing feature. |

## How the demo works

```
features/<area>/pages + components        every screen. Unchanged by the fact that the backend is gone.
        │   useQuery(['recordings', …], () => get('/recordings'))
        ▼
features/<area>/api.ts · src/api/client.ts        typed query and mutation hooks, query keys
        │   request('GET', '/recordings')
        ▼
src/lib/api.ts                            ApiError, get/post/put/patch/del → api.dispatch('GET', '/api/recordings')
        ▼
@portfolio/demo-kit  createMockApi        route matching, 401/403/404/405, validation errors, simulated latency
        ▼
src/demo/handlers/*.ts                    134 routes, one file per area: guards, then a read or write of the store
        ▼
src/demo/core.ts                          store (createStore over the seed), session, api, event bus
```

- **The mock API.** `createMockApi({ prefix: '/api', publicPrefixes: ['/auth/', '/public/'] })`. Everything else answers 401 until someone is signed in. Handlers throw
  `DemoApiError`, which `lib/api.ts` re-dresses as the `ApiError` the screens already understand, with per-field messages. Every route is listed in [`src/demo/routes.md`](src/demo/routes.md).
- **The store.** `createStore(seed, { prepare })`: a `structuredClone` of the typed seed, with every timestamp rebased to now (`rebaseDates`, anchored on 2026-10-01) and about 2,000 generated usage rows added.
  Nothing is written to `localStorage`, `sessionStorage` or IndexedDB; the theme and the English-gloss switch are plain memory. The **reset** button in the banner puts the pristine seed back without a reload.
  The entities are documented in [`src/demo/schema.md`](src/demo/schema.md).
- **The session.** `createSession(accounts, { initial: null })` — it starts signed out. `RequireRole` guards the route groups; the operator's workspace switcher sets an acting tenant
  (`getActingTenantId`), which is what `tenantScope()` returns for every workspace route, so a workspace handler never needs to know who is asking.
- **The simulators.** Long operations are timer-driven state machines that patch the store and emit on the typed bus (`recording:updated`, `kb:changed`, `reembed:progress`, `curation:changed`,
  `convert:progress`, `health:sample`, `usage:appended`, `bot:kill-changed`); screens poll or subscribe. A timer started before a reset drops its write (`demoEpoch`). Examples: the analysers
  finish 1–3 s after Run; imports go processing then ready after 2–4 s; a digest runs a per-call stage then a merge stage; a re-embed advances every 500 ms.
- **The turn stream.** The copilot's server-sent stream is an async generator, `streamTurn(ticket)` in `handlers/copilot.ts`, yielding `open`, `grounding`, `tier1`, word-by-word suggestions, `handoff`, `done` with
  `performance.now()` per stage — so the stage timings on screen are measured, not painted.
- **English glosses.** Georgian content carries optional `*_en` fields; with the UI in English and the gloss switch on, `useGloss().pick(ka, en)` shows the English.
- **Language.** i18next with one namespace per area, English and Georgian, about 2,900 keys each. Georgian text uses Noto Sans Georgian and Noto Serif Georgian; Latin text uses Newsreader (display), Hanken Grotesk (UI) and JetBrains Mono (numbers).

## The data

Fictional throughout: five active workspaces and one deactivated (6 tenants, 14 workspace users, 12 registered users), anchored on **Mtiebi Bank**.

| | |
|---|---|
| Calls | 17 recordings (8 audio, 9 text; Mtiebi Bank 9) built from 16 precomputed canned calls with 83 fact-checked claims |
| Knowledge base | 39 documents (32 public, 7 internal) in 91 chunks; 54 activity events |
| Curation | 7 proposals: 5 pending (update, add, remove), 1 accepted, 1 declined |
| Digests | 3 multi-call summaries |
| Bot | 20 conversations, 92 turns, 19 copilot feedback rows, 7 bot configurations |
| AI setup | 5 providers, 7 connections, 18 assignments, 1 own-key override, 2 chat integrations |
| Usage | about 2,000 generated rows over 90 days, tokens only |
| Voice tools | 8 voices, 6 clips, 5 canned transcripts, 6 converter formats |

Internal consistency is a rule, not a hope: claims cite real chunks, segment indices exist, and weighted totals and accuracy match the same formulas the live code uses.

### Media

Call audio and speech clips are static files under `public/media/calls` and `public/media/tts`, referenced through `mediaUrl()` (`import.meta.env.BASE_URL`), with measured segment timings and waveform peaks in
`src/demo/seed/media-manifest.json` when it exists. The seed is written to work without the manifest: calls then have no audio, estimated timings and placeholder peaks. The editor's demo clip is
imported with Vite's `?inline` and never fetched.

### Adding real audio

The demo ships without audio. To add it, generate speech elsewhere and run two scripts (macOS only, no new dependencies): `node demos/sinji/scripts/media/export-dialogues.mjs <dir>` writes the text to speak (one multi-voice dialogue per call, the speech-tool clips, the voice list), and after the audio is generated, `node demos/sinji/scripts/media/build-media.mjs <audio-dir>` turns files named by id into compact `.m4a` files under `public/media/` and writes `src/demo/seed/media-manifest.json` with measured timings and waveform peaks. Workflow, naming rules and options: [`scripts/media/README.md`](scripts/media/README.md).

## The original architecture

What the product is built from upstream; none of this runs in the demo.

- **Front end.** A Next.js static export served by nginx, which also proxies `/api` to the API on the same origin. Streaming over XHR (upload progress) and server-sent events (copilot turns, digests).
- **API.** A Python FastAPI service, with a separate worker process running the same image.
- **Data.** PostgreSQL 16 with pgvector (an HNSW cosine index over knowledge-base chunks) and pg_trgm for keyword fallback. Idempotent SQL migrations applied at API start. One row per recording holds the transcript,
  analysis, fact-check, tone and scorecard as JSON columns. Every query filters by the workspace id.
- **Auth.** One principal resolver: operator (admin token), workspace (bearer token or API key), registered user (bearer token) or anonymous (by IP). The operator acts as a workspace through a request header.
- **AI layer.** A provider registry with one default connection per capability (language model, speech-to-text, text-to-speech), per-workspace assignments and bring-your-own keys sealed at rest. Every structured
  output is a forced tool call with a strict JSON schema, and the model returns segment indices, never seconds. Every model call goes through one service that meters tokens into a usage table.
- **Pipeline.** Speech-to-text with diarisation, retrieval over the workspace's knowledge base, analysis, claim extraction with per-claim retrieval and verification (fact-check), a tone analyser (text, plus an optional
  self-hosted voice-emotion sidecar whose absence degrades the result to text-only), then rubric scoring: the model scores each dimension and code applies the weights.
- **Knowledge base.** Upload, parse, chunk, embed (a self-hosted embedding model server, 1024 dimensions), retrieve with confidence metrics, scan for duplicates, re-embed as an async job.
- **Chat.** An engine written as an async generator of transport-neutral events, serialised to server-sent events for an external chat service that authenticates with scoped, rotating credentials; triage, a grounding gate,
  a kill switch, copilot drafts and autopilot answers.
- **Worker.** Nightly curation (a SQL miner, embedding clustering, one model proposal per cluster, applied only after a human accepts), queued re-embeds, retention purges, an hourly health purge. In the API process:
  a server-health sampler and a per-workspace load flusher.
- **Infrastructure.** Docker Compose on one Linux server: database, API, worker, embedding server, voice-emotion sidecar, and the nginx web container with TLS. A push to the main branch triggers a webhook that pulls, rebuilds and applies the schema.

## Layout

```
index.html               theme set from the OS before first paint, boot splash
public/
  favicon.svg            the assay-curve mark
  media/calls · tts      call audio and speech clips
src/
  main.tsx · router.ts · routes.tsx    46 lazy-loaded pages: RootLayout > PublicLayout | RequireRole > AppShell
  types.ts               every entity, DemoDb, and the DemoEvents bus map
  api/ · lib/            query client and keys · api, session, gloss, media, scoring, format
  i18n/                  i18next init, common namespace (en, ka)
  styles/                tokens and Tailwind layer
  components/
    ui/                  the design system (see ui/README.md)
    brand/               Logo, Hallmark, AssayGauge, BellCurve, ScorePill, Waveform
    shell/               AppShell, PublicLayout, RequireRole, theme, nav
  features/              one folder per area, each with pages, components, api.ts, locales
    voice-tools          tools home, the audio editor (dsp, player, canvas), ZIP writer
    workbench            calls table, upload queue, call detail, timeline
    analysis             scorecard, tone, call summary, digests
    knowledge-base       layout, overview, documents, import, chunks
    kb-quality           retrieval, duplicates, activity, maintenance, curation (word diff)
    workspace-settings   rubric editor, bands, sentiment, transcription, own AI keys, default rubric
    copilot              harness, drafts, citations, bot configuration, kill switch
    console-platform     workspaces, health (sim/), users, limits, retention, voices
    console-ai           providers, integrations, embeddings, per-workspace AI setup
    usage                filter bar, overview, drill-downs (sim/)
    auth                 sign-in, 404
  demo/
    core.ts · api.ts · session.ts · accounts.ts · context.ts · guards.ts · store.ts · events.ts
    handlers/            one file per area, 134 routes     → routes.md
    seed/                typed seed by area                → schema.md
    generators/usage.ts  the ~2,000 usage rows
    lib/                 text.ts (tokenise, chunk, rank, shingles, checksum) · usage-log.ts
```

About 40,000 lines of TypeScript, of which `src/demo` is about 12,000. The first screen loads only the shell and the public tools; every other route and the charts library are code-split.
