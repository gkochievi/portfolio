# Tova — live demo

A lead-capture arcade game for trade fairs, and the organiser console behind it, running with the
backend cut off.

Visitors at a stand register with their contact details and play a sixty-second canvas round:
catch the falling sponsor coins, dodge the hazards. Then they answer timed trivia for bonus
points, check their card, and watch a live standings board. Organisers run the whole event from a
console — schedule, fairness caps, falling items, trivia, prizes, people — and walk away with the
lead list as an Excel file.

Here the same front end talks to an in-browser mock of the product's API: seed data compiled into
the build, an in-memory store, and a router that answers the same paths with the same payloads.
No server, no database, and no network request of any kind.

| | |
|---|---|
| **The booth** | `/demos/tova/` — landing, register, log in, the game, My card with the trivia panel, public standings, prizes |
| **The console** | `/demos/tova/admin/` — dashboard, events and per-event settings, falling items, trivia, prizes, participants and Excel export, staff standings with a per-player drill-down, Insights, People |

The demo opens **signed out**, on the public landing page, because that is where a visitor at the
stand starts. The pill in the corner (the demo bar) signs you in as any of four roles in one
click. The login page has the same four buttons plus **Enter demo**, which plays as Saba.

## Demo accounts

Every account uses the password **`tova-demo`**. The sign-in code on the Code tab is always
**`123456`**, and it is printed on screen.

| Role | Name | Email | Password | Lands on | Can |
|---|---|---|---|---|---|
| **Player** | Saba Metreveli / საბა მეტრეველი | `saba@tova.example` | `tova-demo` | `/me` | Play, answer trivia, see their card, the standings and the prizes when the organiser has made them visible |
| **Supervisor** | Mariam Abashidze / მარიამ აბაშიძე | `mariam@tova.example` | `tova-demo` | `/admin` | Read-only staff: dashboard, participants and export, staff standings with drill-down, Insights. Always sees the standings, even when hidden. A muted "view only" tag sits in the top bar |
| **Admin** | Davit Lomidze / დავით ლომიძე | `davit@tova.example` | `tova-demo` | `/admin` | Everything a supervisor can, plus create, edit and delete events, items, trivia and prizes. No People page |
| **Superadmin** | Tamar Beridze / თამარ ბერიძე | `tamar@tova.example` | `tova-demo` | `/admin` | Everything, plus People: create accounts, change roles, suspend and restore, delete |

A fifth staff member, Nodar Esebua (`nodar@tova.example`, Admin), exists in the seed and can be
signed in by typing the address; he is not on a button. Saba signed up two hours ago and has
played three rounds of the live event, so the standings have a row that is yours and four trivia
questions are left to answer.

Free-text login works the way the product's does: any well-formed email that is not seeded signs
in as a **guest player** (`guest-<handle>`) with empty contact fields. A seeded email adopts that
account's role. A suspended account is refused. Registering always creates a player and goes
straight to `/play`; a duplicate email is a 409 with the message under the field.

The interface **opens in English** and the toggle in the header is on every page. `?lang=ka` on
the first load opens it in Georgian. The choice lives in memory, so a reload goes back to English
(or to whatever `?lang` says). Light and dark follow the operating system until you pick one in
the header; that choice is in memory too.

## The brand is fictional

The original is a real organiser's platform. Everything that identifies it — name, wordmark,
domain, vendors, event names, every person in the seed, every asset — has been replaced.
**Tova is invented**: *tova* (თოვა) is the Georgian word for snowfall, as in "it is snowing". The
product's whole idea is a snowfall of prizes you try to catch in sixty seconds, so the identity is
glacier blue, a cool frost ground, and one hot persimmon spark (the winter-market fruit against
snow). The fictional organiser is **Ritmuli Events** (რიტმული ივენთსი), the live event is **Narinji
Expo 2026**, and the sponsors on the falling coins are made up: Kvamli Coffee, Mzevali Tea,
Arsiani Bakery, Tetri Kalami and Lurji Velo. None has a logo; each is one flat motif in a circle.

What is kept is the product: the fair-play round, the standings rule, the trivia, the console and
the lead export. The interface is not a restyle of the original but a different design — a
single-column arcade layout for players, a calm plain rail for organisers, an "arcade key" button
with a darker bottom edge that presses down, no glass, no glow and no pill buttons.

## What works

| | |
|---|---|
| **The round** | A real canvas engine. Move the paddle with the pointer, a finger or the arrow keys. Sponsor coins are worth +50, small hazards cost 10, the big one costs 500. Some coins are enhanced (x1.5 or x2). The timer ring turns persimmon and pulses in the last ten seconds. Under reduced motion the timer is a number only |
| **Fairness** | The round is planned up front: every player gets exactly the event's catchable budget and exactly its penalty budget, on a four-stage ramp. Only the arrangement is random. The server clamps a submitted score to the budget as well |
| **Save and card** | The score is saved on game over, with a catch-by-catch breakdown. My card shows total, best, trivia bonus, rounds and the history table |
| **Trivia** | A random unanswered question with shuffled options and a countdown that auto-submits at zero. The seconds-left counter turns red at five. Correct answers add bonus points; the correct index is never sent to the player |
| **Live standings** | Refreshes every ten seconds, with a podium and a list, FLIP reordering and a "last updated" stamp. Score is the **best single round plus correct trivia points** — never a sum of rounds. The organiser can hide the board from the public; the player's card shows a countdown to the end of the event instead of a rank |
| **Ghost players** | Three seeded players keep playing the live event, so the board moves while you watch (below) |
| **Prizes** | Published per event, visible when the organiser says so |
| **Events** | Create, edit, publish and delete. Schedule, round length, fairness caps, difficulty, speed level (x1, x1.5, x2), board size and the three visibility toggles |
| **Falling items** | Create, edit and delete sponsor items and hazards: type, points, spawn weight, active, order, art. The art upload is a stand-in (see below) |
| **Trivia and prizes** | Create, edit and delete, with the validation the product had |
| **Participants** | Searchable lead list, and a real `.xlsx` workbook built in the tab and downloaded |
| **Standings, staff view** | Always visible, event from the switcher, and a drill-down of one player's profile, best, bonus, plays and merged catch breakdown |
| **Insights** | Totals, this month, thirty-day charts, per-event table, top scores and players, catches by item type |
| **People** | Superadmin only: create, change role, suspend and restore, delete. You cannot change, suspend or delete yourself, and a superadmin is protected |
| **Both languages** | English and Georgian, 760 strings each, with the same keys in both |

## Deliberately switched off

| | |
|---|---|
| **A backend** | Nothing is served. Every call is answered by a function in the same tab |
| **Real authentication** | The password is compared in plain text against a seed constant. There is no token, no cookie and nothing to forge: the "server" is a function call. A reload signs you out |
| **Email** | Passwordless sign-in and winner notification mails are not sent. The sign-in code is `123456` and is shown on screen |
| **Object storage** | **Upload** on the items form takes your file name and returns one of four bundled placeholder marks in rotation. The preview uses the local file when the browser can make an object URL for it. Nothing is stored |
| **AI image generation** | The button is there, as in the product, and answers with a coming-soon toast. The product has not shipped it either |
| **Persistence** | None. `localStorage`, `sessionStorage` and IndexedDB are not used for anything. Reload is the reset; the **Reset demo data** button in the demo bar is a reload without the round trip |
| **Notifying winners** | `notifiedAt` is a display field on seeded past events. Nothing is sent |
| **The server-side route gate** | The product's edge gate redirects `/play`, `/me` and `/admin/*` to `/login?next=…`. Here the same redirects are route guards in the client; there is no server in front of them |

## How the demo works

```
features/*/pages + components      the screens. They know nothing about a mock
        │   useCurrentEvents(), useMyCard(), useStandings() …
        ▼
lib/queries.ts · features/*/api.ts  TanStack Query hooks: keys and invalidation
        │   http.get('/leaderboard', { eventId })
        ▼
lib/api.ts                          request() / http.* → api.dispatch('GET', '/api/leaderboard', …)
        ▼
demo/api.ts                         createMockApi({ prefix: '/api', isAuthenticated })   (demo-kit)
        │                           route matching, 401/404/405, latency, abort, structured clone
        ▼
demo/handlers/*.ts                  one register<Group>(api) per feature — 41 routes, see src/demo/routes.md
        │   guards.ts: requireUser · requireStaff · requireEditor · requireSuper
        ▼
demo/store.ts                       createStore(seed, { prepare: rebaseDates }) — the demo's database
```

Alongside the request path run three smaller pieces.

**The store.** `createStore` from `@portfolio/demo-kit` holds the whole database in memory:
`users`, `events`, `items`, `plays`, `questions`, `answers`, `prizes`. Handlers mutate it in
place, call `store.notify()` and emit on the event bus. Requests and responses are structured
clones, as the wire would make them, so a component can never mutate the store by accident. Ids
continue from a counter (`evt_`, `itm_`, `trv_`, `prz_`, `play_`, `usr_`) and are never reused.
Deletes cascade the way the product's did: deleting an event removes its items, prizes, trivia and
answers but leaves its plays, with the event set to null; deleting a user removes their plays and
answers; deleting a question removes its answers.

**The session.** `demo/auth.ts` is a module-level "who is signed in" with `signInAs`, `signOut`
and a `useAuthUserId` hook. It is not demo-kit's `createSession` because registration and guest
logins create users at run time, which a fixed account list cannot express. The mock API's
`isAuthenticated` reads it, so every route answers 401 until someone signs in, except the public
ones (`/events/current`, `/leaderboard`, `/prizes`, and everything under `/auth/`). The role gates
are the guards in `demo/guards.ts`, which throw `DemoApiError` with an i18n key; the UI shows
`t(error.message)`, and field errors land under the right input. Switching user resets every
cached query.

**The simulators.** `demo/simulators/standings.ts` plays the part of the other visitors at the
stand. Three seeded ghost players each play a round of the *active* event every 15–25 seconds
(the first after about eight), with a score of 550–1200 that never exceeds the event's budget and
a catch breakdown that adds up to the score exactly. Each round pushes a play, notifies the store,
and emits `play:created`, which invalidates the standings and Insights queries — so the board
visibly reorders and the numbers in the console move. They use demo-kit's seeded `createRandom`
and `every`, which pauses while the tab is hidden, and leave no timer behind when stopped.

### Date rebasing

A seed with absolute timestamps goes stale the day after it is written: the live event would be
over and nobody would have signed up recently. The seed is written as of `2026-10-01T10:00:00Z`
and `rebaseDates` shifts every key ending in `At` by the distance from that anchor to now, on load
and on every reset. The live event is always "from yesterday to tomorrow", Saba always signed up
two hours ago, and the thirty-day charts always end today. Fair hours are written in UTC, so the
hall day is 11:00–20:00 in Tbilisi.

## Running it

| Command | |
|---|---|
| `npm run dev:tova` | Vite dev server at <http://localhost:5178/demos/tova/> |
| `npm --workspace @demos/tova run build` | `tsc -b --noEmit`, then `vite build` into `demos/tova/dist/` |
| `npm --workspace @demos/tova run typecheck` | TypeScript strict |
| `npm run build` (repo root) | Builds the site and every demo into the deployable `dist/` |

Run all of them from the repo root; the workspace is installed by the root `npm install`.
`VITE_BASE` (default `/demos/tova/`) and `VITE_ROUTER=hash` are the two build-time knobs. The
bundle works in an iframe and under a sub-path: the router takes its basename from `BASE_URL`,
every media path goes through `assetUrl()`, and fonts are bundled from `@fontsource-variable`
rather than fetched.

## The original architecture

Tova is a port of a product Boulder built. The demo is the front end; this is what stood behind it.

| Layer | What it was |
|---|---|
| **Application** | Next.js (App Router) with React 19 and TypeScript. Server components fetched the data for the console and standings; client components called a small set of `/api/*` route handlers for everything that mutates |
| **Styling** | Tailwind CSS v4, Georgian-capable type (Noto Sans and Serif Georgian) and a monospace face for scores |
| **Game** | A custom HTML5 Canvas 2D engine with no game library: a pre-planned spawn schedule, a fixed-step-capped loop, adaptive effects that drop on slow devices |
| **Validation** | zod schemas on every route handler |
| **Auth** | Signed JWT sessions in an `httpOnly` cookie; passwordless sign-in with a one-time code; a route gate (the framework's `proxy.ts`, formerly middleware) redirecting signed-out visitors away from `/play`, `/me` and `/admin` |
| **Data** | A relational database through an ORM, with a unique constraint on (user, question) so a question can be answered once. Users, events, items, plays, trivia questions, answers and prizes |
| **Email** | Transactional mail for the one-time sign-in codes and for notifying prize winners |
| **Storage** | Object storage for the sponsor art an organiser uploads |
| **Export** | A server-built Excel workbook of the participant list, ready to import into a CRM |
| **Anti-cheat** | The server clamps every submitted score to the event's point budget, and the round plan guarantees the same budget for every player |
| **Hosting** | Serverless, with the route handlers and pages deployed together |
| **Planned** | AI image generation for item art (the button exists and says "coming soon") |

The demo keeps the product's behaviour and replaces the three things a browser cannot be: the
database becomes the in-memory store, the route handlers become `demo/handlers`, and the Excel
export moves into the tab (a small OOXML writer and a ZIP writer, below).

## The data

Written by a deterministic generator (`createRandom('tova-seed')`), so every load is identical.
Full field lists are in [`src/demo/schema.md`](src/demo/schema.md).

| Entity | Count | Notable |
|---|---|---|
| Users | 29 | 4 staff plus 25 players. One suspended player, two with no rounds, one with an absurdly long name and company, three ghosts mid-board, and a few with Georgian-script names |
| Events | 9 | Narinji Expo 2026 is live (yesterday to tomorrow, board and prizes visible). Four past events, two upcoming, one on hold with two items, one empty draft |
| Falling items | 35 | 21 sponsor coins, 10 small hazards, 4 big ones. Two inactive, two in the shared library with no event |
| Plays | 122 | 43 in the live event, 30 / 19 / 18 / 12 in the closed ones. Every breakdown adds up to its score, except two rounds that have none |
| Trivia questions | 8 | Six for the live event, two for a past one (one inactive) |
| Trivia answers | 70 | 43 correct |
| Prizes | 8 | Four for the live event (one with no image), four across past events |

Media is 14 small SVGs in `public/media/` — five sponsor marks, five prize illustrations and four
upload placeholders — about 60 KB. No raster images.

## File map

```
src/
  main.tsx, routes.tsx        boot (demo-kit router, simulators) and the lazy route table
  types.ts                    the contract: entities, API shapes, bus events
  api/                        client and query-key helpers
  lib/                        api · assets · queries · queryClient · roles · format · motion · brand · cn
  i18n/                       i18n setup, ?lang, common namespace (en, ka)
  styles/index.css            Tailwind v4 @theme tokens, fonts, dark mode, motion, reduced motion
  components/
    ui/                       Button, Card, Field, Table, SideSheet-style overlays, Countdown, Switch, Tabs, Toast…
    brand/                    Logo, Flakes (decorative snowfall), ItemToken (coin with ink or hazard ring)
  shell/                      RootLayout + DemoBar, PlayerShell, AdminShell, guards, theme, session, language
  features/
    auth/                     login (role buttons, password, code) and registration
    play/                     the game: intro, 3-2-1, canvas round, game over, engine/TovaGame.ts
    player-hub/               landing, My card, trivia panel, prizes
    standings/                public board, staff board, player drill-down
    events/                   console dashboard, events list, event settings
    event-content/            items, trivia and prizes admin
    people/                   People, participants, xlsx.ts and zip.ts (the export)
    insights/                 stats page and charts
  demo/
    seed/                     accounts · people · content · generate · time → the DemoDb
    store.ts, selectors.ts    in-memory database, event bus, derived queries (status, standings)
    api.ts, auth.ts, guards.ts  the mock API instance, the session, the role gates
    handlers/                 auth · core · play · player-hub · standings · events · event-content · people · insights
    simulators/               standings.ts — the ghost players
    schema.md, routes.md      the entities and the endpoints, written out
public/                       favicon and media/ (items, prizes, uploads)
```

Each `features/*` folder owns its pages, components, hooks and its own `locales/<lng>/<ns>.json`;
`src/i18n` gathers them with a glob, so two features never edit the same translation file.

### Two pieces worth reading

- **`features/play/engine/TovaGame.ts`** — the round. `buildPlan` lays out every spawn before the
  clock starts: exact good and bad budgets, a five percent chance of x2 and thirteen of x1.5, four
  stages whose good share falls from 30 to 20 percent while the bad share climbs from 10 to 38,
  fall speeds that grow 1 / 1.28 / 1.6 / 2 across the stages, scaled by difficulty and the event's
  speed level. The loop caps its time step so a stalled tab cannot teleport a coin, eases the
  paddle at a fixed pixels-per-second rate, and switches to a lite mode when the average frame
  time says the device cannot keep up.
- **`features/people/xlsx.ts` and `zip.ts`** — the lead export. A `.xlsx` is a ZIP of XML parts, so
  the tab has a small STORE-method ZIP writer and an OOXML workbook writer on top of it. Strings
  are XML-escaped, control characters stripped, and a cell that starts with `=`, `+`, `-` or `@`
  gets Excel's quote prefix and never a formula element. Phone numbers are written as text so
  Excel does not eat the leading plus.

First load is about 240 KB gzipped for the entry, the shared chunks and the styles, seed
included; every route is its own chunk, and the Insights chunk carries the charting library, so
only a visitor to that page pays for it.
