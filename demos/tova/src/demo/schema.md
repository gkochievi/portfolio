# Tova demo schema

The whole database is `DemoDb` in `src/types.ts`: seven arrays held in memory by
`createStore` (`src/demo/store.ts`). Nothing else is stored — status, standings, bonus points
and every dashboard number are derived on read (`src/demo/selectors.ts`, `handlers/*.ts`).

```
User ──< Play >── GameEvent ──< Item
 │                    │ ├──< Prize
 │                    │ └──< TriviaQuestion ──< TriviaAnswer >── User
 └──────────────────────────────────────────────────────────────┘
```

- **Timestamps** are ISO-8601 UTC strings. Every key ending in `At` (`createdAt`, `startsAt`,
  `playedAt`, `answeredAt`, `notifiedAt` …) is shifted onto "now" by `rebaseDates` on load and on
  every reset; the seed is authored as of `SEED_ANCHOR = 2026-10-01T10:00:00.000Z`.
- **Ids** are strings with a prefix. New rows continue from a counter and are never reused.
- **Media paths** (`imageUrl`) are relative to `BASE_URL` (`media/items/kvamli-coffee.svg`) or a
  `blob:` URL from an upload; `assetUrl()` resolves both. No absolute `/media/...` path exists.
- **Persistence**: none. A reload, or **Reset demo data**, restores the seed.

## Seed volumes

| Entity | Rows | Id prefix |
|---|---|---|
| `users` | 29 (1 superadmin, 2 admins, 1 supervisor, 25 players) | `usr_` |
| `events` | 9 | `evt_` |
| `items` | 35 | `itm_` for new rows; seeded rows keep authored ids |
| `plays` | 122 | `play_` |
| `questions` | 8 | `trv_` |
| `answers` | 70 (43 correct) | |
| `prizes` | 8 | `prz_` |

Fixed ids other code relies on: users `usr_saba`, `usr_mariam`, `usr_davit`, `usr_tamar`,
`usr_nodar`, and the ghosts `usr_g1`, `usr_g2`, `usr_g3`; events `evt_narinji` (live),
`evt_pilpili`, `evt_velo`, `evt_batumi`, `evt_kutaisi` (closed), `evt_rtveli`, `evt_newyear`
(upcoming), `evt_popup` (on hold), `evt_draft` (on hold, empty).

## User

An account: staff, a registered player, or a guest created by a free-text login.

| Field | Type | Notes |
|---|---|---|
| `id` | string | `usr_…` |
| `email` | string | Unique, case-insensitive. Lower-cased on write |
| `username` | string \| null | Unique when set. `[a-z0-9._-]{3,32}`. Guests get `guest-<handle>` |
| `firstName`, `lastName` | string | Empty for guests |
| `phone` | string | Free text as typed at the stand |
| `company`, `position` | string | Lead-capture fields; staff `company` is "Ritmuli Events" |
| `role` | `'SUPERADMIN' \| 'ADMIN' \| 'SUPERVISOR' \| 'PLAYER'` | See roles below |
| `isAdmin` | boolean | True for SUPERADMIN and ADMIN; kept in sync when the role changes |
| `disabled` | boolean | Suspended: cannot sign in, excluded from standings |
| `guest` | boolean | Created by a free-text email or code login rather than registration |
| `createdAt` | ISO date | Signups span the last 30 days, each before that player's first play |

Relations: has many `Play`, has many `TriviaAnswer`. Deleting a user deletes both.

Seed: 4 staff (Tamar Beridze SUPERADMIN, Davit Lomidze and Nodar Esebua ADMIN, Mariam Abashidze
SUPERVISOR) and 25 players. Saba Metreveli is the demo player. One player is suspended, two have
no plays, one has an oversized name and company, four carry Georgian-script names, and three are
ghosts. No seeded user is a guest; guests appear at run time.

**Roles** (`src/lib/roles.ts`): staff = SUPERADMIN, ADMIN, SUPERVISOR; editor = SUPERADMIN, ADMIN;
super = SUPERADMIN. `roleAllows(role, 'staff' | 'editor' | 'super')` combines them.

## GameEvent

One event the stand runs. Status is **derived, never stored**.

| Field | Type | Notes |
|---|---|---|
| `id` | string | `evt_…` |
| `name` | string | 1–120 characters |
| `startsAt`, `endsAt` | ISO date | `endsAt` must be after `startsAt` |
| `durationSeconds` | number | Round length, 10–600, default 60 |
| `maxGood` | number | Fairness cap: exact catchable points every round offers. 1–100 000, default 4000 |
| `maxBad` | number | Fairness cap: exact penalty points every round throws (a positive number). 1–100 000, default 2000 |
| `difficulty` | `'easy' \| 'normal' \| 'hard'` | Scales fall speed (x0.78 / x1 / x1.3) |
| `speedLevel` | `1 \| 2 \| 3` | x1, x1.5, x2 fall speed |
| `leaderboardSize` | number | Rows the board shows, 1–100, default 10 |
| `published` | boolean | Unpublished events are on hold and invisible to the public |
| `awardsVisible` | boolean | Prizes are shown to the public (staff always see them) |
| `leaderboardVisible` | boolean | The board is shown to the public (staff always see it) |
| `notifiedAt` | ISO date \| null | When winners were notified; display only |
| `createdAt`, `updatedAt` | ISO date | |

`EventStatus` = `hold` (not published) · `upcoming` (before `startsAt`) · `open` (inside the
window) · `closed` (after `endsAt`). `eventStatus()` in `selectors.ts`.

Relations: has many `Item`, `Prize` and `TriviaQuestion` (all deleted with the event); has many
`Play`, which **survive** the event with `eventId` set to null.

Seed (caps are `maxGood` / `maxBad`):

| Id | Name | State | Caps | Difficulty / speed | Board | Content |
|---|---|---|---|---|---|---|
| `evt_narinji` | Narinji Expo 2026 | open, -26 h to +30 h, board and prizes visible | 1600 / 600 | normal / x1 | 10 | 9 items, 6 trivia, 4 prizes, 43 plays |
| `evt_pilpili` | Pilpili Food Week 2026 | closed, 12 to 9 days ago, `notifiedAt` set | 1500 / 600 | normal / x1.5 | 10 | 6 items, 2 trivia, 2 prizes, 30 plays |
| `evt_velo` | Lurji Velo City Ride Expo | closed, 5 to 4 days ago, 45 s rounds | 1200 / 400 | easy / x1 | 10 | 5 items, 1 prize, 19 plays |
| `evt_batumi` | Batumi Boulevard Weekend | closed, 19 to 17 days ago | 1400 / 500 | hard / x1.5 | 15 | 4 items, 1 prize, 18 plays |
| `evt_kutaisi` | Kutaisi Tech Fair | closed, 26 to 25 days ago | 1300 / 500 | normal / x2 | 10 | 4 items, 12 plays |
| `evt_rtveli` | Rtveli Harvest Fair | upcoming, in 9 days | 1600 / 600 | normal / x1 | 10 | 3 items |
| `evt_newyear` | New Year Bazaar 2027 | upcoming, in about 80 days | 2000 / 800 | easy / x1.5 | 20 | none |
| `evt_popup` | Kvamli Coffee roastery pop-up | on hold, in 20 days | 1600 / 600 | normal / x1 | 5 | 2 items |
| `evt_draft` | Untitled event | on hold, in 40 days | 1600 / 600 | normal / x1 | 10 | none |

## Item

A falling item. A GOOD item is a sponsor coin; MINOR and MAJOR are hazards.

| Field | Type | Notes |
|---|---|---|
| `id` | string | |
| `eventId` | string \| null | Null = shared library item, not attached to an event |
| `name` | string | 1–80 characters |
| `type` | `'GOOD' \| 'MINOR' \| 'MAJOR'` | |
| `points` | number | Signed, -100 000 to 100 000. Defaults: GOOD +50, MINOR -10, MAJOR -500 (the form opens GOOD at 10) |
| `imageUrl` | string \| null | Sponsor art; hazards have none and are drawn as glyphs |
| `brandName` | string \| null | The "Brand name" field, up to 120 characters |
| `active` | boolean | Inactive items never fall |
| `weight` | number | Spawn weight, 1–100 |
| `sortOrder` | number | 0–10 000 |
| `createdAt`, `updatedAt` | ISO date | |

Relations: belongs to a `GameEvent` (or none). A `CatchTally` refers to an item by name and type,
not by id, so a deleted item does not orphan old plays.

Seed: 35 items — 21 GOOD, 10 MINOR, 4 MAJOR; 2 inactive (a hazard called Slush in the live event
and a library item), 2 library items with no event. The live event has the five sponsors
(Kvamli Coffee, Mzevali Tea, Arsiani Bakery, Tetri Kalami, Lurji Velo) at +50 and weight 5, the
Icicle and Pinecone at -10 and weight 3, the Storm cloud at -500 and weight 1, plus the inactive
Slush. When an active event has no active items, `GET /play/config` falls back to those eight as
built-in defaults.

## Play

One finished round.

| Field | Type | Notes |
|---|---|---|
| `id` | string | `play_…` |
| `userId` | string | Owner |
| `eventId` | string \| null | Null after the event is deleted |
| `score` | number | Clamped on save to `[-maxBad, maxGood]` |
| `duration` | number | Seconds actually played, 1 to the event's `durationSeconds` |
| `breakdown` | `CatchTally[] \| null` | What was caught; null for rounds saved without one |
| `playedAt` | ISO date | |

`CatchTally` = `{ name, type, l1, l2, l3 }`: catches of one item split by enhancement level
(`l1` normal, `l2` x1.5, `l3` x2). Sponsor coins are worth 50 / 75 / 100 across the levels and
small hazards 10 / 15 / 20, so in the seed every breakdown adds up to its round's score exactly.

Seed: 122 plays, weighted to 500–950 and capped by `maxGood`. Two have a null breakdown and one
scores zero. Saba has three in the live event (640, 780, 715).

## TriviaQuestion

| Field | Type | Notes |
|---|---|---|
| `id` | string | `trv_…` |
| `eventId` | string | Belongs to one event |
| `question` | string | 1–300 characters |
| `options` | string[] | 2–4 entries, each up to 120 characters |
| `correctIndex` | number | Index into `options`. **Never sent to players** |
| `points` | number | Bonus for a correct answer, 1–10 000, default 20 |
| `seconds` | number | Answer time limit, 5–120, default 20 |
| `active` | boolean | Inactive questions are not offered |
| `sortOrder` | number | 0–10 000 |
| `createdAt`, `updatedAt` | ISO date | |

Seed: 8 — six for the live event (10–30 points, 12–20 seconds, two to four options) and two for
Pilpili Food Week, one of them inactive.

## TriviaAnswer

| Field | Type | Notes |
|---|---|---|
| `id` | string | |
| `userId` | string | |
| `questionId` | string | |
| `selectedIndex` | number | -1 means the timer ran out |
| `correct` | boolean | |
| `answeredAt` | ISO date | |

Unique per (`userId`, `questionId`): a second attempt is a 409. Deleted with its question or user.
Seed: 70 answers, 43 correct; Saba has answered two of the six live questions.

## Prize

| Field | Type | Notes |
|---|---|---|
| `id` | string | `prz_…` |
| `eventId` | string | Belongs to one event |
| `label` | string | 1–120 characters |
| `description` | string \| null | Up to 500 characters |
| `imageUrl` | string \| null | |
| `sortOrder` | number | 0–10 000 |
| `createdAt` | ISO date | |

Seed: 8 — City bike voucher, Notebook and pen set, Tea gift box and Monthly coffee pass (the
last has no image) for the live event; a Breakfast box and a coffee tasting for two (no image)
for Pilpili; a Bike helmet for Lurji Velo City Ride Expo; a Tea gift box for Batumi Boulevard
Weekend.

## Derived values

| Value | Definition | Where |
|---|---|---|
| Event status | `hold` / `upcoming` / `open` / `closed`, from `published` and the window | `selectors.eventStatus` |
| Active event | Published and now inside the window | `selectors.activeEvent` |
| Current event | The active one, else the latest published event that has started | `selectors.currentEvent` |
| Upcoming event | The next published event that has not started | `selectors.upcomingEvent` |
| Best | A player's highest single `Play.score` in an event | `selectors.bestScore` |
| Bonus | Sum of `points` over a player's correct answers in an event | `selectors.bonusPoints` |
| **Standing score** | **Best + bonus. Never a sum of rounds.** Disabled users and staff excluded; top `leaderboardSize`; ties by name | `selectors.leaderboard` |
| Board hidden | Not staff and `leaderboardVisible` is false: the response is `hidden: true` with no rows | `handlers/standings.ts` |
| Prizes visible | `awardsVisible` or the viewer is staff | `handlers/player-hub.ts` |
| Insights | A fold over the store, recomputed on each request (30 zero-filled day buckets, per-event table, records, catches by type) | `handlers/insights.ts` |

## API shapes

The request and response types live next to the entities in `src/types.ts`:
`SessionUser`, `CurrentEvents`, `ItemDef`, `PlayConfig`, `ScoreSubmit`, `ScoreResult`,
`LeaderRow`, `LeaderboardResponse`, `PlayerDetail`, `TriviaPrompt`, `TriviaState`,
`TriviaAnswerResult`, `MyCard`, `PrizesResponse`, `EventSummary`, `DashboardSummary`,
`ParticipantRow`, `DayCount` and `Stats`. See [`routes.md`](routes.md) for which route returns
which.

## Bus events

`bus` (`createEventBus<DemoEvents>()`) carries the in-browser equivalent of a live channel:

| Event | Payload | Emitted by |
|---|---|---|
| `play:created` | `{ playId, userId, eventId, score, ghost }` | `POST /play/score` and the ghost-player simulator |
| `trivia:answered` | `{ userId, questionId, correct }` | `POST /trivia/answer` |
| `event:changed` | `{ eventId }` | Any admin write to an event or its items, trivia or prizes |
| `user:changed` | `{ userId }` | Registration, guest login, and the People page |
| `demo:reset` | none | The demo bar's Reset |
