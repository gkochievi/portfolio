# Tova demo routes

Every endpoint the mock API answers: **41** `api.register(...)` calls across nine files, all under
the `/api` prefix set in `src/demo/api.ts`. The UI reaches them through `http.get/post/patch/del`
in `src/lib/api.ts`, which calls `api.dispatch` — there is no `fetch` anywhere. Anything not
listed here is a 404 from the mock; a known path with the wrong verb is a 405.

`api.routes()` from `@portfolio/demo-kit` prints the same table at run time.

## How access works

A route is protected by default: the mock answers **401** until someone is signed in
(`isAuthenticated` reads `src/demo/auth.ts`). Routes registered with `{ requiresAuth: false }`,
and everything under `/auth/`, are public. Beyond that, each handler calls one guard from
`src/demo/guards.ts`, which throws a `DemoApiError` carrying an i18n key (the UI shows
`t(error.message)`):

| Auth column | Guard | Allows | Refusal |
|---|---|---|---|
| public | none | anyone, signed in or not | |
| user | `requireUser` | any signed-in, not suspended account | 401 `common:errors.signInRequired`, 403 `common:errors.accountDisabled` |
| staff | `requireStaff` | SUPERADMIN, ADMIN, SUPERVISOR | 403 `common:errors.forbidden` |
| editor | `requireEditor` | SUPERADMIN, ADMIN | 403 `common:errors.forbidden` |
| super | `requireSuper` | SUPERADMIN | 403 `common:errors.forbidden` |

Validation failures are 400s from `DemoApiError.validation({ field: 'ns:errors.key' })`, so a form
shows the message under the right input. Every write calls `store.notify()` and emits on the bus.

File names below are relative to `src/demo/handlers/`.

## Session

| Method | Path | Auth | Purpose | Owner file |
|---|---|---|---|---|
| POST | `/auth/login` | public | `{ identifier, password }` by email or username. A seeded account needs `tova-demo` (401 `auth:errors.badCredentials` otherwise). A well-formed email nobody registered signs in as a new guest player. Suspended: 403 `auth:errors.accountDisabled`. Returns the `SessionUser` | `auth.ts` |
| POST | `/auth/demo` | public | `{ accountId }`: the one-click role buttons and the demo bar. Returns the `SessionUser`; unknown id is 404 | `auth.ts` |
| POST | `/auth/otp/request` | public | `{ email }` → `{ sent: true }`. Nothing is sent; the code is always `123456` and is shown on screen. Malformed email is a field error; a suspended account is refused | `auth.ts` |
| POST | `/auth/otp/verify` | public | `{ email, code }` → `SessionUser`. A wrong code is 400 `auth:errors.badCode`; an unseeded email becomes a guest player | `auth.ts` |
| POST | `/auth/register` | public | `firstName, lastName, phone, email, company, position, password` → `SessionUser` of a new PLAYER. Password at least 6 characters; a duplicate email is 409 `auth:errors.emailTaken`. Emits `user:changed` | `auth.ts` |
| POST | `/auth/logout` | public | Signs out | `auth.ts` |
| GET | `/auth/me` | public | The `SessionUser`, or `null` when signed out or suspended | `auth.ts` |

## Events and the game

| Method | Path | Auth | Purpose | Owner file |
|---|---|---|---|---|
| GET | `/events/current` | public | `CurrentEvents`: `active` (published and inside its window), `current` (active, else the latest published that has started), `upcoming`, and the server `now`. Drives the landing page, the closed state and the countdowns | `core.ts` |
| GET | `/play/config` | user | `PlayConfig`: the active event, its active items (the eight built-in defaults if it has none), the caller's best score, and the upcoming event | `play.ts` |
| POST | `/play/score` | user | `ScoreSubmit { eventId, score, duration, breakdown }` → `ScoreResult { play, score, best, isNewBest }`. 400 `play:errors.eventClosed` unless the event is open, 400 `play:errors.invalidScore` for a non-number. The score is **clamped to `[-maxBad, maxGood]`** and the duration to the event's length. Emits `play:created` | `play.ts` |

## The player

| Method | Path | Auth | Purpose | Owner file |
|---|---|---|---|---|
| GET | `/me/card` | user | `MyCard`: best, trivia bonus, total, rounds, the last 100 plays newest first, and `boardHidden` (not staff and the event's board is off) so the page shows a countdown instead of a rank | `player-hub.ts` |
| GET | `/trivia/state` | user | `TriviaState` for the active event: totals, points earned, and the unanswered active questions **without** `correctIndex` | `player-hub.ts` |
| POST | `/trivia/answer` | user | `{ questionId, selectedIndex }` (-1 = timed out) → `{ correct, timedOut, pointsAwarded }`. 409 `hub:errors.alreadyAnswered` on a second attempt; 400 `hub:errors.noActiveEvent` when nothing is open. Emits `trivia:answered` | `player-hub.ts` |
| GET | `/prizes` | public | `PrizesResponse` for the current event. `visible` is true when `awardsVisible` is on or the viewer is staff; hidden means an empty list | `player-hub.ts` |

## Standings

| Method | Path | Auth | Purpose | Owner file |
|---|---|---|---|---|
| GET | `/leaderboard` | public | `?eventId=` (default: the current event) → `LeaderboardResponse`. Score is best round plus correct trivia points, top `leaderboardSize`, suspended players and staff excluded. A non-staff viewer of a hidden board gets `hidden: true` and no rows; `userId` is blanked for non-staff; `isMe` marks the caller. An unpublished event is 404 to the public | `standings.ts` |
| GET | `/admin/leaderboard/users/:userId` | staff | `?eventId=` → `PlayerDetail`: profile, best, bonus, plays count, the merged catch breakdown with each item's art, and the 200 most recent plays. 404 `standings:errors.playerNotFound` | `standings.ts` |

## Events console

| Method | Path | Auth | Purpose | Owner file |
|---|---|---|---|---|
| GET | `/admin/dashboard` | staff | `DashboardSummary`: player count, play count, and the active event with its counts | `events.ts` |
| GET | `/admin/events` | staff | `EventSummary[]` (the event plus `status`, `itemCount`, `prizeCount`, `triviaCount`, `playCount`), newest start first. Staff, not editor, because the event switcher in the top bar and the supervisor's pages need it | `events.ts` |
| POST | `/admin/events` | editor | `{ name, startsAt, endsAt, durationSeconds? }` → the new event, unpublished, normal difficulty, speed 1, board of 10, caps 4000 / 2000. Emits `event:changed` | `events.ts` |
| GET | `/admin/events/:eventId` | staff | One `EventSummary`. 404 `events:errors.notFound` | `events.ts` |
| PATCH | `/admin/events/:eventId` | editor | Any subset of: `name, startsAt, endsAt, durationSeconds, maxGood, maxBad, difficulty, speedLevel, leaderboardSize, published, awardsVisible, leaderboardVisible`. The window must stay ordered, caps positive, duration 10–600, board 1–100. Field errors are i18n keys | `events.ts` |
| DELETE | `/admin/events/:eventId` | editor | Removes the event with its items, prizes, trivia and answers. Its plays stay, with `eventId` set to null | `events.ts` |

## Items, trivia, prizes

| Method | Path | Auth | Purpose | Owner file |
|---|---|---|---|---|
| GET | `/admin/events/:eventId/items` | staff | `Item[]` by `sortOrder`, then creation time | `event-content.ts` |
| POST | `/admin/events/:eventId/items` | editor | Create an item: name 1–80, type, points ±100 000, weight 1–100, brand name, active, order, art | `event-content.ts` |
| PATCH | `/admin/items/:itemId` | editor | Edit an item; same validation | `event-content.ts` |
| DELETE | `/admin/items/:itemId` | editor | Delete an item | `event-content.ts` |
| POST | `/admin/uploads` | editor | `{ fileName }` → `{ url }`. Returns the next of four bundled placeholder marks, in rotation. No file is read and nothing is sent anywhere; the form prefers a local object URL for its preview | `event-content.ts` |
| GET | `/admin/events/:eventId/trivia` | staff | `TriviaQuestion[]`, with `correctIndex` | `event-content.ts` |
| POST | `/admin/events/:eventId/trivia` | editor | Question up to 300 characters, 2–4 options, a valid `correctIndex`, 1–10 000 points, 5–120 seconds | `event-content.ts` |
| PATCH | `/admin/trivia/:questionId` | editor | Edit a question; same validation | `event-content.ts` |
| DELETE | `/admin/trivia/:questionId` | editor | Delete a question and its answers | `event-content.ts` |
| GET | `/admin/events/:eventId/prizes` | staff | `Prize[]` by `sortOrder` | `event-content.ts` |
| POST | `/admin/events/:eventId/prizes` | editor | Label 1–120, description up to 500, art, order | `event-content.ts` |
| PATCH | `/admin/prizes/:prizeId` | editor | Edit a prize | `event-content.ts` |
| DELETE | `/admin/prizes/:prizeId` | editor | Delete a prize | `event-content.ts` |

## People and leads

| Method | Path | Auth | Purpose | Owner file |
|---|---|---|---|---|
| GET | `/admin/users` | super | Every `User`, ordered SUPERADMIN, ADMIN, SUPERVISOR, PLAYER, then by creation time | `people.ts` |
| POST | `/admin/users` | super | `{ firstName, lastName, email, role, username? }`. Valid email, username `[a-z0-9._-]{3,32}`, a real role. 409 `people:errors.emailTaken`. Emits `user:changed` | `people.ts` |
| PATCH | `/admin/users/:userId` | super | `{ role?, disabled? }`. A role change keeps `isAdmin` in step. 403 for changing your own role (`people:errors.cannotChangeSelf`), suspending yourself (`cannotSuspendSelf`) or suspending a superadmin (`superProtected`) | `people.ts` |
| DELETE | `/admin/users/:userId` | super | Removes the user with their plays and answers. 403 for yourself (`cannotDeleteSelf`) or a superadmin (`superProtected`) | `people.ts` |
| GET | `/admin/participants` | staff | `?q=` → `ParticipantRow[]`: players only, newest signup first, matched against name, email, company, position, phone and username, each with their best score and number of plays. The Excel export is built in the browser from these rows | `people.ts` |

## Insights

| Method | Path | Auth | Purpose | Owner file |
|---|---|---|---|---|
| GET | `/admin/stats` | staff | `Stats`: totals, this month, 30-day registrations and plays (zero-filled), top scores, top players, a per-event table, and catches by item type and by item. A pure fold over the store, recomputed each call, so a visitor's own rounds and the ghosts' rounds appear immediately | `insights.ts` |

## Not registered, on purpose

| Missing | Why |
|---|---|
| Any device or kiosk API, webhooks, mail or storage endpoints | The product's mail and object-storage integrations are not part of the front end. Upload and the sign-in code are stand-ins above |
| `/admin/*` writes for plays | The console has no screen to edit a round; rounds only arrive from `POST /play/score` and the ghost simulator |
| A path that is not in the table | The mock answers 404, which the UI renders as the not-found or error state, as a real server would |
