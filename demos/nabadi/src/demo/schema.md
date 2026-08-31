# `src/demo/` — the contract

The in-browser API that replaces Django for this demo. Everything under
`src/demo/` is new; nothing above it knows the backend is gone.

This file is the interface. If you are writing a **handler module** read §4–§8
and then your module's section of [`routes.md`](./routes.md), which is the route
table. If you are writing a **seed file** read §2–§3. If you are writing the
**seam** (`lib/api.ts` in either tree) read §9.

```
src/demo/
  types.ts       the stored shape of every table — the schema
  base.ts        DemoApiError + the 40-code registry, the clock, latency, money
  store.ts       the tables, id bands, session, constraints, date rebasing
  routes.md      every route: method, pattern, owner, auth, envelope
  query.ts       search / filter / order / paginate
  serialize.ts   media URLs, computed fields, shared nested payloads
  availability.ts  the slot algorithm — one copy, three callers
  router.ts      the route table, dispatch, the auth + role gates
  handlers/      auth · public · barbers · bookings · admin-bookings ·
                 admin-catalog · admin-ops   (+ index.ts, the side-effect barrel)
  seed/          people.json · catalog.json · activity.json (+ index.ts)
  index.ts       boot: constructs the store, installs the handlers
```

---

## 1. The four rules

1. **No network.** Nothing here fetches. Images are files under `public/media/`
   addressed through `import.meta.env.BASE_URL`.
2. **No storage.** No `localStorage`, `sessionStorage` or IndexedDB for demo
   data, the session included. A reload signs you out and restores the pristine
   seed, which is exactly what a server restart does to a session.
3. **One clock.** `Date.now()` appears once, in `CLOCK.now()` (`base.ts`).
   Never call it anywhere else, and never call `new Date()` for "now".
4. **No `Math.random()`.** Latency is a deterministic walk; ids come from
   counters. A demo does not need jitter to look alive, and a reproducible run
   is worth more than one that is different every time.

Files under `src/demo/` use **relative imports only**. `@/` resolves to a
different tree depending on which surface imported it (see `vite.config.ts`), so
it means nothing here.

**Where the original is.** Every "a port of `apps/…`" note in these files points
at `backend/` in the private Django repository this demo replaces. Its path is
deliberately not written down here: the shop is anonymised, and a repository
named after it in a committed file would undo that in one `grep`. Check it out
beside this one and the notes read straight across.

When this document and that tree disagree, the tree wins — say so and fix this
document.

---

## 2. The tables

`store` is a live binding exported from `store.ts`. It holds one property per
table, plus the `landing_content` singleton.

> **Read `store.x` at call time.** `resetStore()` refills the object rather than
> replacing it, so a module that hoists `const bookings = store.bookings` into a
> local goes stale after a reset.

| Table | Row type | Notes |
|---|---|---|
| `users` | `UserRow` | `phone` unique; `email` unique **when non-null** |
| `password_reset_otps` | `PasswordResetOtpRow` | plaintext `code`, 15-min TTL, 5 attempts |
| `specialties` | `SpecialtyRow` | `name` unique |
| `barbers` | `BarberRow` | 1:1 with a user; `specialty_ids` is the M2M, inlined |
| `working_hours` | `WorkingHoursRow` | unique `(barber_id, weekday)`; a missing row means **the shop's hours apply** — see §6.1 |
| `shop_hours` | `ShopHoursRow` | unique `weekday`, ≤ 7 rows; missing on **both** sides = closed |
| `time_off` | `TimeOffRow` | `barber_id: null` = **shop-wide closure** |
| `service_categories` | `ServiceCategoryRow` | `name` (KA) unique |
| `services` | `ServiceRow` | unique `(category_id, name)` |
| `barber_services` | `BarberServiceRow` | unique `(barber_id, service_id)`; the two overrides |
| `bookings` | `BookingRow` | three constraints — see §3.3 |
| `promotions` | `PromotionRow` | `code` unique; exactly one of percent/amount |
| `reviews` | `ReviewRow` | unique `booking_id`; `is_published` defaults **false** |
| `notification_templates` | `NotificationTemplateRow` | unique `(key, channel, language)` |
| `notification_logs` | `NotificationLogRow` | append-only |
| `site_settings` | `SiteSettingRow` | `key` unique; `value` is any JSON |
| `landing_content` | `LandingContentRow` | **singleton object**, `id: 1`, not an array |
| `audit_logs` | `AuditLogRow` | append-only |

### 2.1 Column conventions

- **Foreign keys are `<field>_id: number`.** `booking.customer_id`, not
  `booking.customer`. (The API payload often uses the bare name — that is
  `serialize.ts`'s business, not the store's.)
- **Many-to-many is a `_ids` array on the owning row**: `barber.specialty_ids`,
  `landing_content.featured_reviews`. There is no join table for either.
  `barber_services` **is** a real table, because it carries columns of its own.
- **Money is a 2-dp string**: `"60.00"`, never `60`. Build it with
  `decimalString()`; do arithmetic in tetri with `toMinor()`/`fromMinor()`.
- **Timestamps are ISO with `+04:00`**: `"2026-08-29T14:30:00+04:00"`. Build them
  with `toApiDateTime()` / `nowIso()`; parse with `parseIso()`.
- **`TimeField` is naive wall clock**: `"10:00:00"`, no offset. Cross the seam
  with `instantAt(dateKey, time)`.
- **Weekday is 0 = Monday** (Python's), never `Date.getDay()`. Use `weekdayOf()`.
- **Media is a bare relative key**: `"services/classic-haircut.svg"`. Never a
  URL, never a leading slash — the seed survives a change of deploy base because
  the key carries no base at all. `serialize.mediaUrl()` turns it into a **fully
  qualified URL** at read time (`https://host/demos/nabadi/media/<key>`), not a
  root-absolute path: see §8 for the one call site that makes the difference.
- **`""` vs `null`.** Every text column declared `blank=True, default=""` is
  `""` when empty, never `null` — both front ends call `.trim()` on them. The
  columns that really are nullable are the only ones typed `| null`. The four
  people get wrong: `user.email` is `null`; `booking.walk_in_email`,
  `booking.walk_in_name` and `booking.walk_in_phone` are `""`.

---

## 3. Id bands

Every table allocates from a band of its own and `nextId()` throws rather than
leave it. Postgres gives each table a sequence starting at 1, which means id 3
exists in a dozen tables at once; a stray `"service_id": 4001` in a hand-written
seed would then resolve silently against the barber table. Disjoint bands turn
that into an empty lookup at the row that is actually wrong.

| Table | Band | | Table | Band |
|---|---|---|---|---|
| `users` | **1000–1999** | | `barber_services` | **10000–10999** |
| `password_reset_otps` | **2000–2999** | | `bookings` | **11000–12999** |
| `specialties` | **3000–3999** | | `promotions` | **13000–13999** |
| `barbers` | **4000–4999** | | `reviews` | **14000–14999** |
| `working_hours` | **5000–5999** | | `notification_templates` | **15000–15999** |
| `shop_hours` | **6000–6999** | | `notification_logs` | **16000–17999** |
| `time_off` | **7000–7999** | | `site_settings` | **18000–18999** |
| `service_categories` | **8000–8999** | | `audit_logs` | **20000–21999** |
| `services` | **9000–9999** | | | |

`landing_content.id` is pinned to **1** — Django's singleton `save()` stomps the
pk — and allocates nothing. Ids below 1000 are otherwise reserved. **19000–19999
is a retired band** (it held the feature-permission table); the audit ids above
it are already written, so the hole stays rather than everything renumbering.

Bookings, notification logs and audit logs are double-wide because the visitor
writes into them: every booking appends a notification log, every admin mutation
appends an audit row. `nextId(table)` continues from the seed's highest id in
that band and never reuses one.

### 3.1 Which seed file owns which table

Three files, split so the cross-file references point one way:

| File | Tables |
|---|---|
| `seed/people.json` | `users`, `password_reset_otps`, `specialties`, `barbers`, `working_hours`, `shop_hours`, `time_off` |
| `seed/catalog.json` | `service_categories`, `services`, `barber_services`, `promotions`, `notification_templates`, `site_settings`, `landing_content` |
| `seed/activity.json` | `bookings`, `reviews`, `notification_logs`, `audit_logs` |

`people` stands alone; `catalog` references barbers; `activity` references both.
Load order is enforced by nothing — a dangling id is simply a lookup that
returns `undefined`, which is why §3.3 matters.

`seed/index.ts` narrows the JSON (which widens every enum to `string`) exactly
once. Adding a table means adding a line there and a key to `Tables`.

### 3.2 The clock the seed is written against

Write absolute dates around **2026-08-29**, and make the newest
`bookings.created_at` land on that day at a plausible hour. That row is the
**anchor**: `store.ts` measures the whole-day distance from it to today and
slides the entire world by that offset, so the exact date you choose stops
mattering the moment the demo is opened. What must be true is the *relative*
arrangement — the past behind the anchor, the future ahead of it, each row's
time of day the one you want it to keep.

Do not anchor on `start_at`. The newest appointment is supposed to be ahead of
now; anchoring there would drag it back to today and leave the demo with nothing
in its future.

### 3.3 Invariants the seed must satisfy

`store.validateSeed()` checks all of these at construction, **under
`import.meta.env.DEV` only**, and throws with the table and row id of every
violation at once. A broken invariant is otherwise silent — a dangling
`service_id` renders as `""`, a missing media key as a broken `<img>`, a missing
template as a 404 on one tab of four — and every one of those reads as "the demo
is broken" rather than "the seed is wrong".

1. Every `*_id` resolves to a row that exists, in the right band, and **every
   row's own `id` lies inside its table's band** with headroom left below the
   ceiling. `nextId()` continues from the highest seeded id and refuses to leave
   the band, so a seed that fills a band to its top turns the visitor's first
   write into a thrown error.
2. `start_at < end_at` on every booking; `start_time < end_time` on every hours
   row; `start_datetime < end_datetime` on every time-off row. All three are
   `CHECK` constraints upstream, and the last one makes an overnight shift
   impossible by construction.
3. **No two `pending`/`confirmed` bookings for the same barber overlap.**
   `[start, end)` is half-open, so 10:00–10:30 and 10:30–11:00 are fine.
   Terminal rows (`completed`, `cancelled`, `no_show`) are exempt and may sit on
   top of each other.
4. **No customer holds two `pending`/`confirmed` bookings for the same service.**
   Any barber, any date. Walk-ins (`customer_id: null`) are exempt.
5. `created_at <= start_at` on every booking, and `updated_at >= created_at`
   everywhere both exist.
6. `is_staff === (role === 'admin')` on every user.
7. `user.email` is `null` or unique among non-null emails. Never `""`.
8. A booking is either an account booking (`customer_id` set, all three
   `walk_in_*` fields `""`) or a walk-in (`customer_id: null`, `walk_in_name`
   filled).
9. `reviews.booking_id` points at a **completed** booking and is unique.
10. `notification_templates` holds **16 rows** — 4 keys × 2 channels × 2
    languages. SMS rows have `subject: ""`; email rows have a real subject.
    `TemplateKey` and `TEMPLATE_KEYS` are what this count is taken against, so
    neither may grow: `NotificationLogRow.template_key` is typed
    `TemplateKey | 'password_reset'` instead, because the reset-code SMS is an
    f-string in `ForgotPasswordView` and writes a log row under a key that has
    no template behind it.
11. Every media key names a file that actually exists under `public/media/`.
    There is no filesystem to stat from a browser, so the inventory is written
    down in `store.MEDIA_INVENTORY` and must be extended when a file is added.
    What ships today:

    ```
    barbers/    barber-1.svg  barber-2.svg  barber-3.svg  barber-4.svg  placeholder.svg
    landing/    hero.svg  about.svg  gallery-1.svg … gallery-6.svg
    services/   beard-sculpt.svg  buzz-cut.svg  classic-haircut.svg  cut-and-beard.svg
                cut-and-shave.svg  eyebrow-trim.svg  hair-wash.svg  hot-towel-shave.svg
                kids-cut.svg  skin-fade.svg
    ```

### 3.4 Coverage the seed must have

A screen with nothing in it reads as broken, so the seed must contain at least:

- bookings in every one of the five statuses, including **no-show**;
- **walk-ins** (`customer_id: null` with `walk_in_name` / `walk_in_phone`);
- a booking with a **promotion applied**, and a promotion **near its use limit**;
- **unpublished reviews**, so the moderation queue has work in it;
- `time_off` rows both barber-specific **and** shop-wide (`barber_id: null`);
- `audit_logs` rows, so the audit page is not empty;
- `price_override` / `duration_override` on some `barber_services` rows;
- `shop_hours` for Mon–Sat (weekday 0–5) and **no Sunday row** — the shop is
  closed, and the availability screens are built to say so;
- **one barber missing a weekday's `working_hours` row on purpose.** The
  ShopHours fallback (§6.1) is real upstream behaviour and a seed where every
  barber has every row never exercises it. Today that is barber 4002, who has no
  Monday row and is therefore bookable Monday on the shop's 10:00–20:00. Every
  other barber states their week explicitly, because a *silent* gap is what made
  the earlier seed unreadable.

### 3.5 The two advertised accounts

The banner signs a visitor in as either of these, which is the only way to
discover credentials that live in a seed file. Passwords are plaintext and
compared directly: there is nothing to protect, because the server is a function
call in the same tab. Two buttons is the whole cast: `admin` is the only role the
console admits and `customer` is the only role the customer site has.

| Role | Phone | Password |
|---|---|---|
| customer | `+995555100001` | `nabadi-demo` |
| admin | `+995555300002` | `nabadi-demo` |

`people.json` must contain both rows. It also carries a second `admin` (Tamar
Kapanadze, `+995555300001`) and four `barber` rows; none of them is offered by
the banner, and a `barber` row is a **data tag** on the user behind a `barbers`
row rather than a login — it is what keeps a barber out of the customers list
while `<RequireStaff>` keeps them out of the console.

---

## 4. Writing a handler module

A module has no exports. It calls `register()` at module scope and is imported
once by `handlers/index.ts`.

### 4.0 The route table lives in `routes.md`

**[`routes.md`](./routes.md) is the route table and the only one.** Every route
the mock serves — method, pattern, owning module, `auth`, envelope kind and the
query params to honour — with the reconciliation that produced it: the demand
side is every `api.*` / `apiDownload` / `fetchAllPages` call site in
`src/customer` and `src/admin`, the supply side is the backend's URLconf. Read it
before you register anything.

Two rules it enforces and this file only restates:

- **Exactly one module owns a route.** If your module is not the owner in
  `routes.md`, do not register it — a second `register()` on the same
  `(method, pattern)` silently replaces the first.
- **A path with no caller is not registered.** No index routes, no format
  suffixes, no `/api/schema/`, no `/api/docs/` (ruling #2). `routes.md` §9 lists
  what the backend serves that nobody calls, and why each one stays out.

What the envelope column means, since it is the one that silently destroys a
screen — see §7.1 for the shapes:

| kind | body |
|---|---|
| `paginated` | the DRF envelope `{count, next, previous, results}` |
| `bare array` | a JSON array, no envelope |
| `object` | a plain JSON object — **including a list under a named key**, like
  `{categories: […]}` and `{barbers: […]}`. `routes.md` has no separate kind for
  those; its Notes cell names the key. §7.1 calls this shape `wrap`. |
| `204` | nothing; the handler returns `undefined` |
| `file` | `file(blob, name)` from `base.ts`, for the three XLSX exports |

If you find a call site `routes.md` does not list, that is a row somebody owes —
add it there, not here.

### 4.1 `register(method, pattern, handler, options?)`

```ts
type HttpMethod = 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';

interface RouteOptions {
  auth?: 'public' | 'any' | Role[];   // default 'any'; the array is always ['admin']
}
```

- **Patterns are matched after the `/api` prefix** and keep DRF's trailing
  slash: `/services/`, `/admin/bookings/:id/complete/`. A pattern that does not
  open and close with a slash throws at registration.
- `:name` captures one segment. Captures arrive as **strings** on `req.path`;
  convert them yourself (`Number(request.path.id)`).
- A literal segment beats a capture, so `/admin/bookings/export-xlsx/` and
  `/admin/bookings/:id/` coexist without ordering games.
- **Do not register the verbs Django refuses.** The router answers an unmatched
  method on a matched path with a 405 by itself.
- An unknown role throws **at registration**, not at request time.

### 4.2 The gate

Runs in DRF's order — authenticate, then role — before your handler is called.

| `auth` | Meaning | Failure |
|---|---|---|
| `'public'` | `AllowAny`. `req.user` may still be a signed-in row. | — |
| `'any'` | `IsAuthenticated` (the default) | 401 `not_authenticated` |
| `['admin']` | `IsAdmin` — the only role list any route uses | 401 signed out, else 403 `permission_denied` |

401-before-403 is load-bearing: an anonymous request to an admin route must be a
401 so the console's silent refresh fires, not a 403 that would bounce a visitor
straight to the login page with no explanation.

**Object-level** scoping — "this customer's own booking" — belongs in the
handler, which is the only code that knows which object.

### 4.3 `DemoRequest`

```ts
interface DemoRequest {
  method: HttpMethod;
  url: string;                              // '/admin/bookings/', prefix stripped, no query
  path: Record<string, string>;             // {id: '11003'}
  params: Record<string, string>;           // last value wins, blanks dropped
  paramsAll: Record<string, string[]>;      // repeats kept
  body: unknown;                            // parsed JSON, or FormData
  user: UserRow | null;                     // null only on 'public' routes
}
```

`params` reproduces what `fetch` would have serialised: `null`, `undefined` and
`''` are dropped, everything else is stringified. Both seams put the query
string in the path itself (`api.get('/admin/bookings/?status=pending&page=2')`),
which the router parses; the `params` option exists for completeness.

### 4.4 Return values

| Return | Result |
|---|---|
| any JSON value | 200 with that body |
| `undefined` | 204 — `dispatch` returns `null`, the seam maps it back (§9) |
| `file(blob, filename)` from `base.ts` | a real download (the three XLSX exports) |
| `throw fail(code, field)` | the envelope, at the code's status |
| any other throw | 500 `server_error`, logged to the console |

Handlers may be `async`; `dispatch` awaits the result. There is nothing to await
— the store is synchronous — so prefer not to be.

**No endpoint may return a bare JSON `null`.** `dispatch` collapses `undefined`
to `null` and the seam turns that back into `undefined`, so a handler that
legitimately answered `null` — a `SiteSetting.value` read, say — would be
indistinguishable from a 204. Wrap it: return `{value: null}`.

---

## 5. `base.ts`

### 5.1 Failing

```ts
throw fail('slot_taken', 'start_at');   // 409 — the override table says so
throw fail('phone_taken', 'phone');     // 400
throw notFound();                       // 404 not_found
throw notAuthenticated();               // 401
throw permissionDenied();               // 403
throw validationError('first_name');    // 400 validation_error, field preserved
```

The body is always exactly three keys, in this order:

```json
{ "code": "slot_taken", "message": "That time slot is no longer available.", "field": "start_at" }
```

There is no `detail`, no `errors` array, no per-field DRF dict — the real
exception handler replaces the response body wholesale, so **only the first
problem is ever reported**. A multi-field validation failure collapses to one
`{code, message, field}`; report the first field in declaration order.

`ErrorCode` is a union of the 40 registry codes, so a typo is a compile error.
`message` comes from the frozen registry and must not be hand-written: both
front ends render `t(error.code, {defaultValue: error.message})`, and the
default is what shows in a locale that has not translated the code yet.

**Use a registry code whenever one exists.** DRF's own messages ("This field is
required.") are not registry keys and degrade to `validation_error` with the
field preserved — which is the right answer for a generic field error, and the
wrong answer for anything the backend raises deliberately.

`field` matters: `<Input error>` keys off it, and the customer app's
`isDuplicateActiveBooking()` sniffs `field + message` to tell a duplicate from a
slot race. **You do not have to know it** — `base.ts::FIELD_TABLE` carries the
field each code is normally raised with and `fail(code)` applies it, so a typo is
a compile error rather than a silently mis-keyed form. The whole table lives
beside the message registry; the summary:

| field | codes |
|---|---|
| `phone` | `phone_invalid`, `phone_taken` |
| `email` | `email_taken` |
| `password` | `password_weak` |
| `code` | `otp_invalid`, `otp_expired` |
| `start_at` | `slot_taken`, `outside_working_hours`, `time_off_overlap`, `lead_time_too_short`, `too_far_in_advance`, `cancellation_window_passed` |
| `service_id` | `duplicate_active_booking`, `service_not_active`, `barber_does_not_offer_service`, `barber_service_exists` |
| `barber_id` | `barber_not_active` |
| `booking_id` | `booking_not_completed`, `review_already_exists` |
| `status` | `invalid_transition` |
| `promo_code` | all five `promo_*` |
| `role` | `last_admin` |
| `date_from` | `export_range_required`, `export_too_large` |
| `start_datetime` | `time_off_in_past` |
| `null` | `credentials_invalid`, `not_authenticated`, `permission_denied`, `booking_not_found`, `cannot_deactivate_self`, `sms_disabled`, `test_send_failed`, `validation_error`, `not_found`, `throttled`, `server_error` |

Override it only where the same code is raised somewhere other than its usual
place. There are exactly four: `fail('slot_taken', 'status')` on an un-cancel
PATCH; `fail('duplicate_active_booking', 'start_at')` when the duplicate surfaces
as a write race rather than the pre-check; `fail('phone_invalid', 'recipient')`
on a notification test-send; `fail('password_weak', 'new_password')` on
change-password. Pass `null` explicitly to suppress the default.

Five codes have a **forced status** regardless of where they are raised —
`slot_taken`, `duplicate_active_booking`, `invalid_transition` and `sms_disabled`
are 409, and `booking_not_found` is **404 even when raised as a field error on a
serializer**. `fail()` applies that table for you.

### 5.2 The clock

```ts
CLOCK.now()                       // epoch ms — the only reading of the wall clock
nowIso()                          // '2026-08-29T14:30:00+04:00' — what auto_now stamps
toApiDateTime(ms | Date | iso)    // the same, from any instant
toApiDate(x) / dateKey(x)         // '2026-08-29' in Tbilisi
todayKey()                        // dateKey(CLOCK.now())
parseIso(iso)                     // epoch ms, or NaN
shiftDayKey(key, days)            // day arithmetic on the key
dayKeyDistance(from, to)          // whole days between two keys, in ms
dayStartMs(key)                   // the instant Tbilisi midnight opens
instantAt(key, '10:00:00')        // a TimeField on a given day, as an instant
minutesOfDay(ms) / timeString(m) / timeToMinutes('10:00:00')
weekdayOf(key | ms)               // 0 = Monday
MINUTE, HOUR, DAY, TZ_OFFSET_MS, TZ_SUFFIX, TIME_ZONE
```

Day boundaries are drawn in Asia/Tbilisi, never in the visitor's zone — the same
thing Django did with `USE_TZ` and `TIME_ZONE`. Georgia has no DST, so the
offset is a constant `+04:00` and the arithmetic is exact.

### 5.3 Money

```ts
decimalString(60)          // '60.00'
decimalString('45.5')      // '45.50'
decimalStringOrNull(null)  // null
toMinor('45.50')           // 4550
fromMinor(4095)            // '40.95'
```

Rounding is half-away-from-zero at 2 dp, matching `numeric(10,2)`. Anything that
has to be exact — a promo discount — goes through tetri.

---

## 6. `store.ts`

### 6.1 Lookups

Linear scans, deliberately: four barbers and a few dozen bookings are cheaper
than indexes that would have to be kept honest across every mutation. Each one
re-imposes the model's `Meta.ordering` at the walk.

```ts
userById · userByPhone · userByEmail          // email is matched case-insensitively
barberById · barberForUser                    // barberForUser is the barber_profile relation
serviceById · categoryById · bookingById
promotionById · promotionByCode               // code__iexact
barberServiceFor(barberId, serviceId)
reviewForBooking(bookingId)
orderedBarbers(rows?)                         // display_order, then user first_name
orderedByDisplay(rows)                        // display_order, then name
hoursFor(barberId, dateKey)                   // barber's row, else the shop's, else null
timeOffOverlapping(barberId, startMs, endMs)  // includes shop-wide closures
openIntervals(barberId, dateKey)              // the shift, time off punched out
barberWorksOn(barberId, dateKey)              // any of it at least one slot long
```

**The working-hours fallback, stated once.** `hoursFor` takes the barber's
`working_hours` row for that weekday; if there is none it takes the shop's
`shop_hours` row; if there is neither the barber is closed that day. It is a
**pure fallback, never an intersection** — a barber with a row of their own may
legitimately work outside shop hours, and a barber with no rows at all is
governed entirely by the shop's week. §2's table, `types.ts::WorkingHoursRow` and
`availability.ts` all say this; if you are about to change one, change all four.

`barberWorksOn` is **not** "no time off touches the day". A one-hour dentist
appointment does not close a shop: `openIntervals` subtracts the closures and
`barberWorksOn` is true while at least one granularity unit survives. Build slot
lists on `openIntervals`, never on `timeOffOverlapping` — and in practice build
them on `availability.ts` (§8.1), which does it for you.

### 6.2 Session

```ts
currentUser()              // the signed-in row, or null (an inactive user reads as null)
isSignedIn() · signIn(user) · signOut()
```

`user.role` is the whole permission model. **`admin` is the only role that reaches
the console**, and the router's `auth` array is the only thing that enforces it.

### 6.3 Settings

```ts
getSetting('business_phone')                  // the raw JSON document, or undefined
bookingSetting('cancellation_window_hours')   // int-coerced, with the static fallback
smsNotificationsEnabled()                     // absent row ⇒ enabled
BOOKING_DEFAULTS                              // 15 / 30 / 60 / 2
```

The four booking knobs resolve as: the row's value coerced with `int()`, or the
static Django default when the row is absent or would not coerce. A row holding
JSON `null` reads as absent — `get_setting()` cannot tell the two apart either.

**What "SMS disabled" does to a booking write.** Nothing, except that the SMS
channel is silent:

- **No `notification_logs` row is written for the SMS channel at all.** Not a
  `success: false` row — `NotificationLog` has no "skipped" state and a failure
  row would read in the console as a delivery that went wrong, which is a
  different and worse story than "the shop turned SMS off". Upstream pins this
  (`notifications/tests/test_sms_toggle.py::test_flag_off_skips_sms_provider`).
- The **email** channel is unaffected and still logs.
- The write itself succeeds. `logNotification()` (§6.5) applies all of this; a
  handler calls it and does not check the toggle.

**The 409 `sms_disabled` belongs to one endpoint only**:
`POST /admin/notification-templates/{id}/test-send/`, for an SMS template, and it
still writes its audit row with `success: false, error: "sms_disabled"`. Booking
creation, cancellation and the reminders never raise it.

### 6.4 Constraints and the sweep

```ts
overlapsExistingBooking({id?, barber_id, start_at, end_at, status})  // → slot_taken 409
duplicatesActiveBooking({id?, customer_id, service_id, status})      // → duplicate_active_booking 409
autoCompleteStaleBookings()                                          // runs itself on every dispatch
```

Both predicates are partial: they only see `pending` and `confirmed` rows. Call
them **before** mutating, then mutate — JS is single-threaded, so there is no
race to lose and the `select_for_update` they were paired with upstream is a
no-op. Pass the candidate's own id when checking an update, or it collides with
itself.

```ts
if (overlapsExistingBooking(candidate)) throw fail('slot_taken', 'start_at');
if (duplicatesActiveBooking(candidate)) throw fail('duplicate_active_booking', 'service_id');
```

### 6.5 Writing rows

```ts
const booking: BookingRow = { id: nextId('bookings'), /* … */, created_at: nowIso(), updated_at: nowIso() };
store.bookings.push(booking);
```

In order, every write path should: coerce blanks to `""`/`null`, run the
constraint predicates, allocate the id, stamp `created_at`/`updated_at`, mutate,
then fire the side effects. **Both side effects have a helper; do not hand-roll
either.**

```ts
import { writeAudit, logNotification } from '../store';

writeAudit(request, 'booking.cancel', 'booking', booking.id, {
  status: { old: previous, new: 'cancelled' },
  cancellation_reason: booking.cancellation_reason,
});
logNotification(booking, 'booking_cancellation');
```

`writeAudit(source, action, entity, entityId, payload?)` is **synchronous**,
because upstream's `audit_log()` is called inline in the view and the row must be
readable the instant the mutation returns. `source` is anything carrying the
acting user — pass the `DemoRequest`. It owns `nextId`, the `actor_role`
snapshot (denormalised, so a later role change cannot rewrite history), the
loopback `ip`/`user_agent`, and a backstop that drops `password`-like keys.

`logNotification(booking, templateKey, language?)` is **deferred with
`queueMicrotask`**, because upstream enqueues its Celery task from
`transaction.on_commit`: the notification is a consequence of a committed write
and must not be able to fail it. It owns the template lookup (exact
`(key, channel, language)`, falling back to the English row), the rendering, the
recipient choice, the per-channel dedup, and the SMS toggle (§6.3). Language
defaults to `ka`, as `_resolve_language` does.

Its three parts are exported too, because `admin-ops` needs them for the
template preview and test-send endpoints and a second renderer would drift:
`templateFor(key, channel, language)`, `notificationContext(booking)` and
`renderTemplate(template, context)`.

#### The action vocabulary

`<entity>.<verb>`, lower snake case on both halves, and the entity matches the
`entity` argument. The complete set, from `apps/admin_api/`:

| entity | actions |
|---|---|
| `booking` | `walk_in_create`, `update`, `cancel`, `complete`, `no_show`, and `bookings.export` |
| `customer` | `update`, and `customers.export` |
| `user` | `create`, `update`, `role_change`, `activate`, `deactivate`, `reset_password` |
| `barber` | `create`, `update`, `deactivate`, `photo_upload`, `photo_remove` |
| `barber_service` | `assign`, `unassign`, `update` |
| `service` | `create`, `update`, `delete`, `image_upload`, `image_remove` |
| `service_category` · `promotion` · `site_setting` · `working_hours` · `shop_hours` · `time_off` · `notification_template` | `create`, `update`, `delete` |
| `review` | `publish`, `unpublish`, `delete` |
| `landing` | `update` |
| `notification` | `test_send` |
| `analytics` | `export` |

The two export actions are plural (`bookings.export`, `customers.export`) because
they are about a list rather than a row; their `entity` is still the singular
noun and their `entity_id` is `""`.

#### The payload shape

| verb | payload |
|---|---|
| `…​.create` | the validated body, flat: `{code: 'FIRSTCUT', percent_off: 10}` |
| `…​.update` | `{changes: {field: {old, new}}}` — **only the fields that moved** |
| `…​.delete` | `{snapshot: {…}}` — the row as it was, captured **before** the splice |
| a named transition | the moved fields at the top level: `{status: {old, new}}` |
| an export | `{filters: {…}, row_count: n}` |

`{old, new}` values are JSON scalars: a money `Decimal` is its 2-dp string, a
datetime its ISO string, a related object its id, an M2M a sorted array of ids.
The pre-delete snapshot is the whole point of auditing a hard delete — `entity_id`
alone is useless once the row is gone — so take it first. Never put a password,
token, OTP or secret in a payload.

Deleting is an in-place splice, which keeps the live binding intact:

```ts
store.reviews.splice(store.reviews.indexOf(review), 1);
```

### 6.6 Uploads

```ts
row.photo = trackObjectUrl(URL.createObjectURL(file));
releaseObjectUrl(previous);   // safe with a seed key, an http URL or null
```

`mediaUrl()` passes an object URL through untouched, which is what makes an
uploaded photo appear a moment after it is picked. The registry exists so
`resetStore()` can revoke them all.

---

## 7. `query.ts`

Django reaches into the ORM by field path; here each helper takes an accessor,
so `barber__user__first_name` becomes a closure at the call site.

```ts
applySearch(rows, params, [(r) => r.walk_in_name, (r) => userById(r.customer_id)?.phone])
applyFilters(rows, params, { status: (r) => r.status, is_active: (r) => r.is_active })
applyRelationFilter(rows, params, 'barber_id', { pk: (r) => r.barber_id })
applyMultiFilter(paramsAll, rows, 'status', (r) => r.status)
applyDateRange(rows, params, (r) => r.start_at)                        // date_from / date_to
applyDateRange(rows, params, (r) => r.start_at, { from: 'from', to: 'to' })
applyOrdering(rows, params, {
  created_at: (r) => parseIso(r.created_at),   // dates through parseIso
  price:      (r) => toMinor(r.price),         // money through toMinor
}, '-created_at')
newestFirst(rows, (r) => r.start_at) · oldestFirst(rows, (r) => r.start_at)
asDate(raw) · asBoolean(raw) · asId(raw)
mustDate(params, 'date')                       // 400 instead of "no filter"
```

Three Python behaviours are load-bearing and easy to lose in translation:

- an **unparseable date in a list filter means "no filter"**, not an empty result
  — `?date_from=2026-02-31` is swallowed rather than turning a list request into
  a 500;
- a **malformed relation or boolean value is ignored**, not matched as a string;
- **nulls sort last ascending and first descending**, because that is what
  Postgres does, and negating an ascending comparison would do the opposite.

Two traps in the accessors:

- **A date is not always a filter.** Where the date is the *subject* of the
  request — `/barbers/:id/availability/?date=` and
  `/availability-summary/?from=&to=` — the backend raises 400
  `validation_error`, and the wizard has an error branch waiting for it. Use
  `mustDate()` there, `asDate()` in the admin list filters. The availability
  endpoints report `field: "date"` for every parse failure, `service_id`
  included.
- **A bare money accessor sorts as text**, so `"100.00" < "60.00"`. Any 2-dp
  string column reached through `applyOrdering` needs `toMinor()`, exactly as a
  date column needs `parseIso()`.

`applyMultiFilter`/`paramsAll` model a repeated query key. **No endpoint in this
API has one** — every backend filter is `query_params.get(...)`, i.e. Django's
last-value-wins QueryDict, which `req.params` already reproduces. They exist
because `paginate()` needs `paramsAll` to rebuild a `next` URL without collapsing
repeats. Do not reach for `applyMultiFilter` to model an existing endpoint.

### 7.1 The four envelopes

A list is not always a list. Four shapes reach the client, and `routes.md`'s
Envelope column names the one each endpoint uses. The tags below (`page`, `arr`,
`wrap`, `obj`) are this section's shorthand; `routes.md` spells them
`paginated`, `bare array`, `object` (for both `wrap` and `obj`), `204` and `file`.

**1. The DRF envelope (`page`)** — everything paginated:

```ts
register('GET', '/admin/reviews/', (request) =>
  paginate(reviewQueryset(request), request, serializeAdminReview), { auth: ['admin'] });

// /admin/bookings/ and /admin/customers/ use AdminPageNumberPagination
register('GET', '/admin/bookings/', (request) =>
  paginate(bookingQueryset(request), request, serializeAdminBooking, { clientPageSize: true }),
  { auth: ['admin'] });
```

**2. A bare array (`arr`)** — `GET /admin/barbers/`,
`GET /admin/barbers/{id}/services/`, and every `GET /admin/analytics/*` that
returns a series.

**3. A wrapped object (`wrap`)** — a list under a named key, which is neither of
the above and is what the customer site's two main reads return:

```ts
// GET /services/  →  {categories: [{id, name, name_en, display_order, services: [...]}]}
register('GET', '/services/', (request) =>
  serializeCatalog(asId(request.params.barber_id) ?? undefined), { auth: 'public' });

// GET /barbers/  →  {barbers: [...]}
register('GET', '/barbers/', () =>
  ({ barbers: orderedBarbers(store.barbers.filter((b) => b.is_active)).map(serializeBarber) }),
  { auth: 'public' });
```

`useServices()` types the reply `{categories: ServiceCategory[]}` and reads
`category.services`; `useBarbers()` types it `{barbers: BarberItem[]}`. A bare
array or a DRF envelope there renders an empty service picker with no error
anywhere. `serializeCatalog()` does the nesting once (§8) — including the
`?barber_id=` narrowing and the "drop a category left empty" rule — so do not
rebuild it.

**4. A plain object (`obj`)** — everything else, including both availability
endpoints, `/landing/`, `/bookings/me/stats/` and every detail route.

The DRF envelope's **`next` is a real absolute URL**, built from the deploy-aware
API prefix and the request's own repeated query keys:

```json
{ "count": 137, "next": "http://host/demos/nabadi/api/admin/bookings/?status=pending&page=3",
  "previous": "http://host/demos/nabadi/api/admin/bookings/?status=pending", "results": [] }
```

`admin/lib/paginated.ts::fetchAllPages()` loops until `next === null`, so a
hard-coded `next: null` silently truncates every filter dropdown, working-hours
grid and client-side-filtered list at 25 rows, with no error anywhere. Page 1
omits `page` entirely — which is also what the console's `withPage()` does — so
`previous` from page 2 is the bare path.

- `PAGE_SIZE` is **25** everywhere.
- `page_size` is honoured **only** with `{clientPageSize: true}`, only on
  `/admin/bookings/` and `/admin/customers/`, and is clamped to 100. Junk
  (`0`, `-3`, `abc`) falls back to 25.
- `?page=last` is accepted. A page past the last is **404 `not_found`**, as DRF
  answers an `InvalidPage`. Page 1 of an empty list is still a page.

Everything else under `/admin/` is paginated. When in doubt, read the Envelope
column of `routes.md` — it is derived from the call sites, not from memory.

---

## 8. `serialize.ts`

What lives here: **shared, or structurally tricky.** A booking is serialised
three different ways (customer, staff, admin) and each of those shapes belongs
in the module that owns its endpoint — a serializer read apart from its view is
a serializer that drifts. What all three need is here.

```ts
mediaUrl(key)                       // a FULLY QUALIFIED url; object URLs pass through
bilingual(row, 'name')              // → {name, name_en} — send both, never pick
fullName(user) · barberName(barber) · customerName(booking)
customerPhone(booking)              // null for a walk-in
searchablePhones(booking)           // both numbers, for applySearch only
isWalkIn(booking)
effectivePrice(barberId, serviceId) // null when the barber does not offer it
effectiveDuration(barberId, serviceId)
linkPrice(link) · linkDuration(link)          // the same, from a BarberService row
cancellableUntil(booking) · canCancel(booking, now)
serializeUser
serializePublicService (9 keys) · serializeAdminService (12 keys)
serializeCategory · serializeCatalog(barberId?)   // {categories: [{…, services}]}
specialtiesOf(barber) · barberServices(barberId) · serializeBarber
serializeReview
serializePromotion · promotionRedeemable(promo, now) · applyPromotion(promo, price)
```

Notes worth reading before you reimplement one of these:

- **Never pick a language.** The API sends `name` **and** `name_en`; the front
  ends run `pickLocalized`, falling back to the Georgian column when the English
  twin is `""`.
- **`mediaUrl` returns an absolute URL**, `https://host/demos/nabadi/media/…`,
  not `/demos/nabadi/media/…`. Thirteen call sites drop it straight into an
  `<img src>` and would take either; the fourteenth,
  `admin/pages/admin/BarberDetail.tsx`, strips `/api` off `API_BASE` and prefixes
  the result — which, with `API_BASE = ${BASE_URL}api`, would prepend the deploy
  base a second time and 404 every photo on that page. An absolute URL takes its
  `startsWith('http')` passthrough and is right for all fourteen.
- **The public service shape is not the admin one.** `serializePublicService`
  emits the nine keys of `ServiceOutSerializer`; `is_active` and `display_order`
  are staff data and `category` does not appear at all, because the public
  grouping *is* the nesting `serializeCatalog()` builds.
- **`effectivePrice` checks `!= null`, not truthiness.** A `price_override` of
  `"0.00"` is a real override — a free service — and must not fall back to the
  catalogue price. Same for a zero `duration_override`. Both helpers return
  **`null` when there is no `BarberService` row at all**: every upstream caller
  treats that as "not offered" and drops the row or raises
  `barber_does_not_offer_service`, and quoting the catalogue price for a service
  a barber does not do is worse than showing nothing.
- **`specialties` is `{id, name}[]`, never `string[]`.** Every consumer renders
  `s.name` with `key={s.id}`.
- **`serializeBarber` carries `services[]`** — four keys each, no `name_en` —
  because `BarberDetail.tsx` reads `barber.services.length` unguarded. It does
  **not** carry `is_active`; the public list is already filtered.
- **`serializeReview` emits `customer_name`**, PII-reduced to `"First L."`, and
  `""` when the booking has no account holder. Never fall back to
  `walk_in_name`: that is a full name a receptionist typed, and publishing it
  leaks exactly what the reduction exists to prevent. The **moderation queue's
  `customer_name` is a different field with the same name** —
  `AdminReviewSerializer` sends the full name and *does* fall back to
  `walk_in_name`, because the console is staff-only. That shape belongs to
  `admin-ops`; do not serve it from `serialize.ts` and do not reconcile the two.
- **`customerPhone` is `null` for a walk-in**, whose number travels in its own
  `walk_in_phone` key. The console branches on `booking.customer` to pick
  between them. `searchablePhones()` is the one place they are treated as one,
  because the admin filter is
  `Q(customer__phone__icontains) | Q(walk_in_phone__icontains)`.
- **`serializeUser` never carries** `password`, `notes`, `is_active`, `is_staff`,
  `is_superuser`, `last_login` or a token. `notes` is staff-only free text about
  a customer and the source file says in capitals not to expose it there.
- **`promotionRedeemable` order matters**: inactive → not started → expired →
  exhausted. An inactive-and-expired promo reports `promo_inactive`. The
  `valid_until` comparison is strictly greater, so the boundary instant is still
  valid.
- **`applyPromotion` rounds once, after the subtraction.** Rounding the discount
  first differs by a tetri on a half-tetri discount, and `price_at_booking` is a
  frozen snapshot the UI prints verbatim.

### 8.1 `availability.ts`

The slot algorithm, in one place, because three modules have to answer "when can
this barber do this service" identically or the wizard offers a slot the POST
refuses:

```ts
slotsFor(barberId, serviceId, dateKey, now?)          // → [{start_at, end_at}] ascending
daySummary(barberId, serviceId, from, to, now?)       // → [{date, has_service_slot, has_any_slot}]
availabilityFor(barberId, serviceId, dateKey)         // the GET /availability/ envelope
availabilitySummaryFor(barberId, serviceId, from, to) // the GET /availability-summary/ envelope
slotProblem(barberId, serviceId, startAtMs, {mode})   // → the error code, or null
```

The response shapes are `AvailabilityResponse` and `AvailabilitySummaryResponse`
verbatim from `customer/features/booking/hooks.ts` (the console declares the same
four interfaces in `admin/features/admin/hooks.ts`); use the envelope builders
rather than assembling the wrapper yourself.

- **`barbers.ts`** serves both GETs from `availabilityFor` / `availabilitySummaryFor`.
- **`bookings.ts`** validates `POST /bookings/` with `slotProblem(...)` and
  throws `fail(code)` on a non-null answer.
- **`admin-bookings.ts`** does the same for walk-in create and reschedule with
  `{mode: 'staff'}`, which replaces the lead-time and advance-horizon rules with
  upstream's "not in the past".

What the layering guarantees: `slotsFor` and `slotProblem` read the same
`openIntervals` — the same shift, the same time off — so a slot the wizard offers
cannot fail placement validation. The one thing `slotProblem` does *not* check is
overlap with another booking: upstream has no overlap query and lets the DB
EXCLUDE raise, so that stays `overlapsExistingBooking()` and a 409 `slot_taken`
rather than a 400.

Three deliberate details, all reproduced from the source and all easy to
"fix" into a bug:

- The grid is **re-anchored per free interval**, so the starts after a booking
  that ends at 11:20 are 11:30 / 11:45 / …, visibly offset from the morning's.
- `min_lead` / `max_advance` bound the **start** only, inclusively; a slot may
  end after the horizon.
- `daySummary` does **not** align to the grid and is a separate implementation
  upstream, so an off-grid free interval of exactly the service's length reports
  `has_service_slot: true` while `/availability/` returns nothing for it. It only
  ever over-promises. A calendar that disagreed the other way would grey out
  days that are actually bookable, which is why the asymmetry is kept.

---

## 9. `router.ts` and the seam

`dispatch(method, path, {params?, body?})` is what each `lib/api.ts` calls in
place of `fetch`. It accepts an absolute URL or a bare path, strips the origin
and the API prefix, spends the latency, runs the stale-booking sweep, resolves
the route, runs the gate and calls the handler.

**The prefix is base-aware.** `API_BASE` is `${import.meta.env.BASE_URL}api`, so
under the portfolio's default base a call arrives as
`/demos/nabadi/api/services/`; `dispatch` strips `${BASE_URL}api` first and a
bare `/api` second, and both reduce to `/services/`. Nothing in the seam needs to
know this — but do not "simplify" either side to a hard-coded `/api`, because
`VITE_BASE=/` hides the breakage and the default base 404s every request.

The seam has four jobs:

1. **Errors.** Convert `DemoApiError` into the app's own `ApiError` —
   `new ApiError(err.status, err.code, err.message, err.field)`. The body is the
   same three keys both parsers already destructure.
2. **204.** `dispatch` resolves `null` where `fetch` would have given a 204, and
   there is no `res.status` left to test. Map it: `result === null ? undefined : result`.
   Safe because no endpoint returns a bare JSON `null` (§4.4).
3. **Downloads.** Unwrap a `file()` reply — `isFileResponse(result)` — into the
   Blob plus the filename `apiDownload()` would have parsed out of
   `content-disposition`.
4. **401.** See below. This is the one that can wreck the demo.

#### The 401 path

`fetchWithRefresh` retries a 401 through `refreshSession()` and, when that fails,
calls `redirectToLogin()`. Both need replacing, and the replacement is not
optional:

- **`POST /auth/refresh/` answers 204 when there is a session, and 401
  `not_authenticated` when there is not.** Upstream's `RefreshView` sends 200
  with an empty body, not 204 and not `{"detail":"ok"}` — but the mock has no
  status code to send: `dispatch()` resolves a value, a handler spells "no body"
  by returning `undefined`, and item 2 above maps that to what the seam would have
  read off a 204. The two are therefore the same object here, and the demo calls
  it 204 because that is the mock's own vocabulary for an empty reply and what
  `routes.md` §1 registers. The refresh cookie is replaced by `store.session`.
  Answering *success* for a signed-out visitor is the failure that matters: it
  would put the console into a refresh-and-retry loop, which is why the route's
  usual answer is the 401.
- **`redirectToLogin()` becomes a `pushState`, never `window.location.assign`.**
  The shipped helper navigates to a root-absolute `/login?next=…`, which is both
  the wrong path under a deploy base and, far worse, **a full page load — which
  wipes the in-memory store and silently resets the whole demo**, on nothing more
  than an anonymous deep link into the console. Replace it with a history push to
  the console's own login through `surface.ts`:

  ```ts
  import { ROUTER_MODE, surfaceUrl } from '../../surface';

  function redirectToLogin(): void {
    const next = encodeURIComponent(window.location.pathname + window.location.search);
    const target = `${surfaceUrl('admin')}login?next=${next}`;   // trailing slash already there
    if (ROUTER_MODE === 'hash') {
      window.location.hash = target.slice(target.indexOf('#') + 1);
    } else {
      window.history.pushState(null, '', target);
      window.dispatchEvent(new PopStateEvent('popstate'));       // pushState fires nothing itself
    }
  }
  ```

  It targets the **console's** login, not the site's (ruling #18), and it is
  base-aware and router-mode-aware because `surfaceUrl()` derives from
  `import.meta.env.BASE_URL` and `__DEMO_ROUTER__`. `surface.ts` is the module
  that already knows the difference between the two modes — do not re-derive it
  in `lib/api.ts`.

`registeredRoutes()` lists what exists, for a boot log or a sanity check.

---

## 10. Date rebasing, and what it does to your seed

At construction, `store.ts` runs four phases in this order. You do not call any
of it; you only need to know what it will do to the rows you write.

1. **Shift.** The whole world slides by the whole-day distance from the newest
   `bookings.created_at` to today. Whole days, measured in Tbilisi, so every row
   keeps its time of day — the seed's ten-o'clock appointments stay ten-o'clock
   appointments.
2. **Compress today.** Past-tense columns (`created_at`, `updated_at`,
   `last_login`, `date_joined`, reminder markers, log timestamps) that land on
   today are squeezed into the fraction of the day that has actually elapsed,
   and clamped so nothing in the archive is newer than the moment it is read.
   Appointment times, closures and promotion windows are **not** squeezed — a
   booking at 15:00 is supposed to be in the future.
3. **Re-arm.** Unconsumed password-reset codes are re-issued as if sent ninety
   seconds ago, because a fifteen-minute window is expired the rest of the day
   wherever the seed's authoring hour happened to be.
4. **Realign.** A uniform shift preserves the spread but not the *mix*, and the
   console opens on today's list. So: finished appointments are pulled back
   behind now, active ones pushed ahead of it, and then the fewest rows are
   nudged the smallest whole number of days until today holds a few appointments
   and a few more sit ahead. Every move is checked against the overlap
   constraint and skips a day the barber does not work, so the realignment can
   never invent a double-booking or an appointment on a closed Sunday.

Then `autoCompleteStaleBookings()` runs — and again on every dispatch. Any
`pending`/`confirmed` booking whose `end_at` is more than 24 hours past becomes
`completed`. Without it an elapsed booking sits invisible in every `/me/` tab
while still arming the `(customer, service)` partial unique, and the visitor
collects a permanent, unexplainable 409 on the one service they tried first. It
is also the only thing that can move a booking the visitor just made into
`completed`, which is what makes leaving a review reachable at all.

The practical consequence for a seed author: **write relative arrangements, not
absolute dates.** "Three weeks before the anchor, at 11:00" survives; "the
Tuesday after the long weekend" does not.
