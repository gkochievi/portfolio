# `src/demo/routes.md` — the route table

Every route the mock serves, and nothing else. **93 routes across seven handler
modules.** Read `schema.md` first — this file uses its vocabulary and does not
repeat it.

The table is reconciled from both ends: the demand side is every `api.*` /
`apiDownload` / `fetchAllPages` call site in `src/customer` and `src/admin`; the
supply side is `backend/core/urls.py`, the eight app `urls.py`, `urls_me.py`, the
17 router registrations in `apps/admin_api/urls.py` and the 25 `@action` methods
under `apps/admin_api/views/`. §9 lists what the backend serves that nobody
calls, with the reason. §10 flags the mismatches.

---

## 0. How to read a row

**Path pattern** is the literal string passed to `register()`, after the `/api`
prefix, with DRF's trailing slash intact. A pattern that does not open and close
with a slash throws at registration.

```ts
register('POST', '/admin/bookings/:id/complete/', handler, { auth: ['admin'] });
```

**Owner** — one of `auth · public · barbers · bookings · admin-bookings ·
admin-catalog · admin-ops`. Exactly one module owns each route; nobody else may
register it.

**auth** — `public` (`AllowAny`), `any` (`IsAuthenticated`, the default), or the
exact role list, which is always `['admin']`: the console is the only signed-in
staff surface and `admin` is the only role it admits. Object-level scoping ("this
customer's own booking") is never in this column: the gate does not know which
object, so it lives in the handler.

**Envelope** — `paginated` (DRF `{count, next, previous, results}`), `bare array`,
`object`, `204`, `file`. This is the column that silently destroys a screen.
`admin/lib/paginated.ts::fetchAllPages` loops until `next === null`, so a list
that should be paginated but ships a bare array truncates at 25 rows with no
error; one that should be bare but ships an envelope renders nothing. Every value
below was checked against the real view's `pagination_class`. `PAGE_SIZE` is 25;
`page_size` is honoured only where the Notes say so.

**Notes** — query params to honour, the ordering to impose, the body shape, and
the error codes the route raises deliberately. Codes come from the `base.ts`
registry; five carry a forced status (`slot_taken`, `duplicate_active_booking`,
`invalid_transition`, `sms_disabled` → 409; `booking_not_found` → 404) and
`fail()` applies it.

---

## 1. `auth` — `/api/auth/*` (9 routes)

| Method | Path pattern | Owner | auth | Envelope | Notes |
|---|---|---|---|---|---|
| POST | `/auth/register/` | auth | public | object | 201. `{phone, password, first_name, last_name, email?}`. Creates a `customer` and signs the session in. `phone_taken`/`phone_invalid` on `phone`, `email_taken` on `email`, `password_weak` on `password`. Blank/absent email stores `null`. Response is `serializeUser`. |
| POST | `/auth/login/` | auth | public | object | `{phone, password}`. Plaintext compare against the seed row. Unknown phone, wrong password **or an inactive user** → 401 `credentials_invalid`, field `null` — never distinguish the three. Same body as `GET /auth/me/`. |
| POST | `/auth/refresh/` | auth | public | 204 | No body. Called only by the admin seam's `refreshSession()` after a 401. There are no tokens to rotate: return 204 when `currentUser()` is non-null, throw `notAuthenticated()` otherwise — which is what drives `redirectToLogin()`. Upstream answers 200 with an empty body; the seam reads only `res.ok`, so 204 is indistinguishable. |
| POST | `/auth/logout/` | auth | public | 204 | No body. Idempotent — `signOut()` and 204 whether or not anyone was signed in. |
| GET | `/auth/me/` | auth | any | object | The app's boot probe; both front ends call it on mount and 401 is the normal signed-out answer, not an error to dress up. Carries `role`, which is what the console's `<RequireStaff>` gates on. Never `password`, `notes`, `is_active`, `is_staff`. |
| PATCH | `/auth/me/` | auth | any | object | `{first_name?, last_name?, email?: string\|null}`. `""` or `null` email → stored `null`; a duplicate among non-null emails → 400 `email_taken` on `email`. `phone` and `role` are immutable and silently ignored. |
| POST | `/auth/change-password/` | auth | any | 204 | `{old_password, new_password}`. Wrong old password → 401 `credentials_invalid`. Weak new one → 400 `password_weak` on `new_password`. Overwrites the row's plaintext password and **keeps** the current session signed in. |
| POST | `/auth/forgot-password/` | auth | public | 204 | `{phone}`. **Always 204**, even for an unknown or inactive phone — this endpoint must never become an account-existence oracle. On a hit: append a `password_reset_otps` row (plaintext `code`, 15-min TTL, `attempts: 0`) and a `notification_logs` row. |
| POST | `/auth/reset-password/` | auth | public | 204 | `{phone, code, new_password}`; `code` is exactly 6 digits. Pick the newest OTP for that user that is unconsumed, unexpired and under 5 attempts. No user, no such OTP, or a mismatch → 400 `otp_invalid` on `code`; a mismatch also increments `attempts`, and hitting 5 kills the code even for the correct value. On success stamp `consumed_at` and set the password. |

**The hard ones.** `GET /auth/me/` — every other screen waits on it, and its
`role` is what `<RequireStaff>` reads, so getting it wrong locks the admin out of
the console. `/auth/refresh/` — the only route
whose right answer is usually a failure; returning 204 unconditionally puts the
seam in a retry loop on every signed-out 401.

---

## 2. `public` — `/api/services/`, `/api/landing/` (2 routes)

| Method | Path pattern | Owner | auth | Envelope | Notes |
|---|---|---|---|---|---|
| GET | `/services/` | public | public | object | `{categories: [{id, name, name_en, display_order, services: [...]}]}`. Categories ordered `display_order, name`; services likewise; **`is_active` services only**. `?barber_id=N` (truthy-tested at the call site, so `0`/`null` never reach you): keep only services that barber has a `barber_services` row for, substitute `effectivePrice`/`effectiveDuration`, and **drop categories left with an empty `services` array**. Without `barber_id`, catalogue price/duration and every category, empty or not. |
| GET | `/landing/` | public | public | object | The `landing_content` singleton flattened with three CMS-sourced blocks: `featured_reviews` (the singleton's `featured_reviews`, **published only**, ordered **`-created_at`** — `filter(is_published=True).order_by('-created_at')`, so the order the CMS put the ids in does **not** survive; PII-reduced by `serializeReview`), `business: {address: {ka, en}, phone, email}`, `social_links` (the raw `site_settings` map), `map_embed_url` (`""` when unset — the components take a documented degraded path). Hits `site_settings`, so it must re-read at call time. |

**The hard ones.** `/services/?barber_id=` — three behaviours ride on one param
(override substitution, non-offered filtering, empty-category dropping) and the
booking wizard's step 0 is the only screen that exercises them. `/landing/` — the
customer footer, `/contact`, the hero and the gallery all render from this one
payload, so a missing key blanks four surfaces at once; and
`""` vs `null` matters, every consumer calls `.trim()`. The featured reviews are
a **queryset, not a list**: the M2M is unordered and the view imposes
`-created_at`, so reordering `featured_review_ids` through
`PATCH /admin/landing/` moves nothing on the page and unpublishing a featured
review silently drops it. This table said the stored id order was kept; it was
wrong, and `spec/api-public.md` §5.1.4 is the authority.

---

## 3. `barbers` — `/api/barbers/*` (3 routes)

| Method | Path pattern | Owner | auth | Envelope | Notes |
|---|---|---|---|---|---|
| GET | `/barbers/` | barbers | public | object | `{barbers: [...]}` — **not** a bare array. `is_active` only, ordered `display_order, user.first_name`, each with `specialties` (inlined from `specialty_ids`) and the services they offer. `photo` through `mediaUrl()`. |
| GET | `/barbers/:id/availability/` | barbers | public | object | Required `?date=YYYY-MM-DD&service_id=N`. Either missing, or unparseable → 400 `validation_error` on `date`. 404 `not_found` if the barber is missing/inactive, the service missing/inactive, or no `barber_services` row links them. Returns `{barber_id, service_id, date, slots: [{start_at, end_at}]}` — ISO with `+04:00`, ascending. Slot walk: the barber's `working_hours` row for that weekday else `shop_hours` else no slots; step by `slot_step_minutes`; drop anything overlapping a `pending`/`confirmed` booking or a `time_off` row (barber's **or** shop-wide); honour `min_lead_time_minutes` and `max_advance_days`. |
| GET | `/barbers/:id/availability-summary/` | barbers | public | object | Required `?from=&to=&service_id=`; any missing → 400 `validation_error` on `date`. A reversed range is swapped, not rejected; a window **> 60 days** is 400. Same 404 triad as above. `{barber_id, service_id, from, to, days: [{date, has_service_slot, has_any_slot}]}` — one entry per day inclusive, no gaps. `has_any_slot` ignores the service's duration; `has_service_slot` does not. |

**The hard ones.** The two availability endpoints — every booking screen on both
surfaces reads them, they are the only place the working-hours / shop-hours /
time-off / existing-booking layers all compose, and `availability-summary`
answers up to 60 days in one call. Get the half-open `[start, end)` convention
right or 10:00–10:30 and 10:30–11:00 will fight. All three are public, so they
are also the only admin-free reads in the table.

---

## 4. `bookings` — `/api/bookings/*` (4 routes)

| Method | Path pattern | Owner | auth | Envelope | Notes |
|---|---|---|---|---|---|
| POST | `/bookings/` | bookings | any | object | 201. `{barber_id, service_id, start_at, notes?, promo_code?}`. In order: barber active (`barber_not_active`), service active (`service_not_active`), the `barber_services` link exists (`barber_does_not_offer_service`), lead time (`lead_time_too_short`), horizon (`too_far_in_advance`), inside working/shop hours (`outside_working_hours`), no time-off overlap (`time_off_overlap`), then `overlapsExistingBooking` → 409 `slot_taken` on `start_at` and `duplicatesActiveBooking` → 409 `duplicate_active_booking` on `service_id`. `end_at = start_at + effectiveDuration`. `price_at_booking = effectivePrice`, then the promo: `promo_invalid` / `promo_inactive` / `promo_not_started` / `promo_expired` / `promo_exhausted` on `promo_code`, in that order. Customer booking — `customer_id` set, all three `walk_in_*` fields `""`. Then queue the notification log. |
| GET | `/bookings/me/` | bookings | any | paginated | `?status=upcoming\|past\|cancelled&page=N`. `upcoming` = `pending`/`confirmed` with `start_at > now`, **ascending**; `past` = `completed`/`no_show`, `-start_at`; `cancelled` = `cancelled`, `-start_at`; anything else = every row, `-start_at`. Signed-in customer's rows only. |
| GET | `/bookings/me/stats/` | bookings | any | object | `{total_bookings, completed_bookings, upcoming_bookings, total_spent, last_visit_at}`. `total_spent` sums `price_at_booking` over **completed** rows and is a 2-dp string (`"0.00"` when none); `last_visit_at` is the max `start_at` over completed rows, or `null`. `upcoming_bookings` counts active rows with `start_at > now`. |
| DELETE | `/bookings/:id/` | bookings | any | 204 | Customer cancels their own. Not theirs or nonexistent → 404 `booking_not_found` (the same answer for both — do not leak). Already `cancelled` → **204, idempotent, no mutation, no audit**. `completed`/`no_show` → 409 `invalid_transition` on `status`. Past `start_at - cancellation_window_hours` → 400 `cancellation_window_passed` on `start_at`. On success set `status`, `cancelled_by_id`, `updated_at`. |

**The hard ones.** `POST /bookings/` is the demo's centrepiece and the longest
validation chain in the mock — nine ordered checks, and only the *first* failure
is ever reported, so the order is the contract. `DELETE /bookings/:id/` is the
only route in the API that enforces the cancellation window; staff cancel through
`DELETE /admin/bookings/:id/`, which does not.

---

## 5. `admin-bookings` — `/api/admin/{bookings,customers,users}/` (17 routes)

| Method | Path pattern | Owner | auth | Envelope | Notes |
|---|---|---|---|---|---|
| GET | `/admin/bookings/` | admin-bookings | `['admin']` | paginated | Filters, all optional: `status` (exact), `barber_id`, `service_id`, `customer_phone` (**substring, case-insensitive, against the account phone OR `walk_in_phone`**), `date_from`/`date_to` (Tbilisi **date** bounds on `start_at`, inclusive). Order **`-start_at`**. Honours `page_size` (`clientPageSize: true`), clamped to 100, junk → 25. Also read through `fetchAllPages` for the day calendar. |
| POST | `/admin/bookings/` | admin-bookings | `['admin']` | object | 201. `{barber_id, service_id, start_at, customer_id?, walk_in_name?, walk_in_phone?, walk_in_email?, notes?}`. Either an account booking (`customer_id` set, `walk_in_*` all `""`) or a walk-in (`customer_id: null`, `walk_in_name` filled) — never both. Same slot validation as `POST /bookings/`, including `slot_taken`; `duplicate_active_booking` applies only when `customer_id` is set. Audit `booking.walk_in_create`. |
| GET | `/admin/bookings/export-xlsx/` | admin-bookings | `['admin']` | **file** | Same filters as the list. **`date_from` AND `date_to` are required** → 400 `export_range_required` on `date_from` when either is missing; > 10 000 rows → 400 `export_too_large` on `date_from`. Real `.xlsx` via `demo/xlsx.ts` + `demo/zip.ts` — the one workbook writer all three exports call — one `Bookings` sheet, 12 columns (ID, Date, Time, Customer, Phone, Walk-in, Barber, Service, Price, Status, Notes, Created), filename `bookings_<today>.xlsx`. Audit `bookings.export` with the filters and row count. |
| PATCH | `/admin/bookings/:id/` | admin-bookings | `['admin']` | object | `{start_at?, status?, notes?, cancellation_reason?}`. Simultaneously the reschedule, the confirm, the cancel-with-reason and the un-cancel. Illegal transition → 409 `invalid_transition` on `status`. A reschedule recomputes `end_at` from the barber's effective duration — falling back to the catalogue row's `duration_minutes` when the barber has dropped the service since, and handing that duration to `slotProblem({duration})` rather than refusing the move — re-validates working hours + time-off, clears both reminder markers, and re-runs the overlap/duplicate predicates (`slot_taken` on `start_at`). Only a service deleted out from under the booking is still `barber_does_not_offer_service`. Un-cancelling (`cancelled` → active) clears `cancelled_by_id` and `cancellation_reason` and re-arms both constraints. Audit `booking.update` with a full old→new diff. |
| DELETE | `/admin/bookings/:id/` | admin-bookings | `['admin']` | 204 | Staff cancel — **no cancellation-window check**, which is the whole reason this route exists beside `DELETE /bookings/:id/`. Already `cancelled` → 204, no mutation, no audit. Terminal → 409 `invalid_transition` on `status`. Otherwise set `cancelled_by_id` to the actor and audit `booking.cancel`. |
| POST | `/admin/bookings/:id/complete/` | admin-bookings | `['admin']` | object | No body. Non-active → 409 `invalid_transition`. Returns the admin-shaped booking. |
| POST | `/admin/bookings/:id/no-show/` | admin-bookings | `['admin']` | object | As above with `status: 'no_show'`. |
| GET | `/admin/customers/` | admin-bookings | `['admin']` | paginated | `role === 'customer'` rows only. `search` (substring, case-insensitive, over phone/first_name/last_name/email), `active` (**only the exact strings `'true'`/`'false'`**, anything else ignored), `has_bookings` (**only `'true'`**). Order `-date_joined`. Honours `page_size` (`clientPageSize: true`). Each row carries the computed `booking_count`, `total_spent` (2-dp string over completed rows) and `last_visit_at`. |
| GET | `/admin/customers/export-xlsx/` | admin-bookings | `['admin']` | **file** | Same filters, **no date requirement**. > 10 000 rows → 400 `export_too_large` on `search`. Same writer (`demo/xlsx.ts`); one `Customers` sheet, 10 columns (ID, First name, Last name, Phone, Email, Bookings, Total spent, Last visit, Active, Joined), filename `customers_<today>.xlsx`. Audit `customers.export`. |
| GET | `/admin/customers/:id/` | admin-bookings | `['admin']` | object | A non-customer id 404s. Same annotated shape as the list row. Unlike `/auth/me/`, this payload **does** carry `notes` and `is_active` — it is the staff view. |
| PATCH | `/admin/customers/:id/` | admin-bookings | `['admin']` | object | `{first_name?, last_name?, email?: string\|null, notes?, is_active?}` — whitelist; `phone` and `role` are immutable. Blank/`null` email → `null`; duplicate → 400 `email_taken` on `email`. `is_active` coerces `"false"`. Audit `customer.update` with only the fields that actually changed. |
| GET | `/admin/users/` | admin-bookings | `['admin']` | paginated | Staff only (`admin`/`barber`); customers never appear. `role` (ignored unless it is one of the two staff roles), `search` (same four fields), `active` (`'true'`/`'false'` exactly). Order **`role, first_name, last_name, id`**. Default pagination — **no `page_size`**. A `barber` row here is a data tag, not a login: no barber reaches the console. |
| POST | `/admin/users/` | admin-bookings | `['admin']` | object | 201. `{phone, first_name, last_name, email?, role, password}`; `role` must be a staff role (`admin` or `barber`). Creating a `barber` also creates the `barbers` row. `is_staff` must come out as `role === 'admin'`. Audit `user.create` with identifying fields — **never the password**. |
| PATCH | `/admin/users/:id/` | admin-bookings | `['admin']` | object | `{first_name?, last_name?, email?: string\|null, role?}`. Demoting the **last active admin** → 400 `last_admin` on `role`. Switching a user *to* `barber` creates the missing `barbers` row. Audit action is `user.role_change` when the role moved, else `user.update`. |
| POST | `/admin/users/:id/reset-password/` | admin-bookings | `['admin']` | 204 | `{new_password}`. Sets it and signs that user's session out if it is theirs. Audit `user.reset_password` with an **empty payload** — the new password must never reach a log. |
| POST | `/admin/users/:id/activate/` | admin-bookings | `['admin']` | object | No body. Returns the staff user. Audit records `is_active` old→new. |
| POST | `/admin/users/:id/deactivate/` | admin-bookings | `['admin']` | object | No body. **Deactivating yourself → 400 `cannot_deactivate_self`**, field `null` — it is also the only path to killing the last admin. Otherwise flip `is_active` and, if it is the current session, sign out. |

**The hard ones.** `PATCH /admin/bookings/:id/` is the single most intricate route
in the mock: it is simultaneously the reschedule, the confirm, the
cancel-with-reason and the un-cancel path, and each of those re-arms a different
constraint. `GET /admin/bookings/` is the most
read route in the console — three separate hooks hit it (unwrapped list, paged
envelope, `fetchAllPages` day view) and it is one of only two routes honouring
`page_size`. The two exports are the only `file` returns on this module and their
preconditions differ (bookings demands a date range, customers does not).

---

## 6. `admin-catalog` — services, categories, barbers, hours, time-off (32 routes)

| Method | Path pattern | Owner | auth | Envelope | Notes |
|---|---|---|---|---|---|
| GET | `/admin/services/` | admin-catalog | `['admin']` | paginated | No filters. Order `category_id, display_order, name`. Read both via `fetchAllPages` (dropdowns) and `withPage` (the Services pager), so `next` must be real. |
| POST | `/admin/services/` | admin-catalog | `['admin']` | object | 201. `{category, name, name_en?, description?, description_en?, duration_minutes, price, icon_key?, is_active?, display_order?}`. `category` is the bare id. Unique `(category_id, name)`. Upstream stacks a wider permission class with an in-method admin check; both collapse to the same 403 here. |
| PATCH | `/admin/services/:id/` | admin-catalog | `['admin']` | object | Every field is patchable, and the reply is always the full service — upstream's narrower price-only serializer had no role left to answer. Money is a 2-dp string. |
| DELETE | `/admin/services/:id/` | admin-catalog | `['admin']` | 204 | Cascades the `barber_services` rows; snapshot the row into the audit payload before splicing. |
| POST | `/admin/services/:id/image/` | admin-catalog | `['admin']` | object | **Multipart**: `request.body` is a `FormData` with field **`image`**. Upstream validates nothing — no size cap, no type check — and the mock mirrors that. `releaseObjectUrl` the previous value, then `trackObjectUrl(URL.createObjectURL(file))`. Returns the **full service**, not 204. Audit `service.image_upload`. |
| DELETE | `/admin/services/:id/image/` | admin-catalog | `['admin']` | object | Returns the **full service body, not a 204** — the caller types it `AdminService`. Release the object URL, set `image` to `null`. Audit `service.image_remove`. |
| GET | `/admin/service-categories/` | admin-catalog | `['admin']` | paginated | Order `display_order, name`. Each row carries a computed `service_count`. Read via `fetchAllPages`. |
| POST | `/admin/service-categories/` | admin-catalog | `['admin']` | object | 201. `{name, name_en?, display_order?}`. `name` (KA) unique. |
| PATCH | `/admin/service-categories/:id/` | admin-catalog | `['admin']` | object | `{name?, name_en?, display_order?}`. |
| DELETE | `/admin/service-categories/:id/` | admin-catalog | `['admin']` | 204 | Pre-delete snapshot into the audit row. |
| GET | `/admin/barbers/` | admin-catalog | `['admin']` | **bare array** | **Not paginated** — a plain ViewSet upstream. Order `display_order, user.first_name`, each row with `user_phone`/`user_first_name`/`user_last_name`/`user_email`, `specialties` and a computed `service_count`. Includes inactive barbers. |
| POST | `/admin/barbers/` | admin-catalog | `['admin']` | object | 201. `{phone, first_name, last_name, email?, password, bio?, specialties?: number[], display_order?}`. Creates the `users` row (`role: 'barber'`, `is_staff: false`) **and** the `barbers` row. `phone` runs through `normalizePhone` and is stored E.164 — `phone_invalid` when it will not normalise, `phone_taken` on the normalised value, `email_taken` on the address. **A deliberate divergence:** `BarberAdminCreateSerializer` is a plain `Serializer` upstream and does neither (`spec/api-admin-b.md` §11.1), but every other lookup in the API normalises first, so a raw-stored row is invisible to every search — and the missing uniqueness check lets `/auth/register/` mint a second account for the same person. Audit payload carries the identifying fields and `specialty_ids` — never the password. |
| GET | `/admin/barbers/:id/` | admin-catalog | `['admin']` | object | Same shape as a list row. Literal segments (`export-xlsx` has no twin here) are not an issue, but `:id/services/` and `:id/photo/` are siblings — the router prefers literals. |
| PATCH | `/admin/barbers/:id/` | admin-catalog | `['admin']` | object | `{bio?, specialties?: number[], display_order?, is_active?}` — `specialties` replaces `specialty_ids` wholesale. Also the target of the activate/deactivate toggle (`{is_active}` alone). Audit diff must render M2M as sorted id arrays on both sides. |
| DELETE | `/admin/barbers/:id/` | admin-catalog | `['admin']` | 204 | **Soft delete** — sets `is_active: false`, never splices. Bookings reference barbers and the row must survive. Audit `barber.deactivate`. |
| POST | `/admin/barbers/:id/photo/` | admin-catalog | `['admin']` | object | **Multipart**, field **`photo`**. Returns the full barber. Release the previous object URL first. Audit `barber.photo_upload` with size and name. |
| DELETE | `/admin/barbers/:id/photo/` | admin-catalog | `['admin']` | object | Returns the full barber **body, not 204**. Capture the old key into the audit payload before clearing — it is the only trace left. |
| GET | `/admin/barbers/:id/services/` | admin-catalog | `['admin']` | **bare array** | **Not paginated.** Ordered by `service.display_order, service.name`. Each row: `id`, `service_id`, `service_name`, `service_name_en`, `service_is_active`, `base_price`, `base_duration_minutes`, `price_override`, `duration_override`, `effective_price`, `effective_duration_minutes`. Effective values use `!= null`, so a `"0.00"` override is a free service, not a fallback. |
| POST | `/admin/barbers/:id/services/` | admin-catalog | `['admin']` | object | 201. `{service_id, price_override?: string\|null, duration_override?: number\|null}`. Already assigned → 400 `barber_service_exists` on `service_id`. Audit `barber_service.assign`. |
| PATCH | `/admin/barbers/:id/services/:barberServiceId/` | admin-catalog | `['admin']` | object | `{price_override?, duration_override?}`. **JSON `null` clears the override; an omitted key leaves it untouched** — the distinction is the whole feature. A `barberServiceId` belonging to a different barber must 404, not silently edit. |
| DELETE | `/admin/barbers/:id/services/:barberServiceId/` | admin-catalog | `['admin']` | 204 | Same cross-barber 404 scoping. Snapshot the serialized row (overrides included) into the audit payload **before** splicing. |
| GET | `/admin/working-hours/` | admin-catalog | `['admin']` | paginated | **No `barber` filter** — the console pulls every page via `fetchAllPages` and filters client-side, precisely because one page of 25 silently drops working days once there are more than four barbers. Order `barber_id, weekday`. `next` must be real. |
| POST | `/admin/working-hours/` | admin-catalog | `['admin']` | object | 201. `{barber, weekday, start_time: 'HH:MM', end_time: 'HH:MM'}` — `barber` is the bare id, `weekday` is 0 = Monday. Unique `(barber_id, weekday)`; `start_time < end_time`. Store times as `"HH:MM:SS"` even though the client sends `"HH:MM"`. |
| PATCH | `/admin/working-hours/:id/` | admin-catalog | `['admin']` | object | `{start_time?, end_time?}`. Re-check `start_time < end_time` against the merged row. |
| DELETE | `/admin/working-hours/:id/` | admin-catalog | `['admin']` | 204 | A missing row means "does not work that day", so deleting is a real availability change. Pre-delete snapshot. |
| GET | `/admin/shop-hours/` | admin-catalog | `['admin']` | paginated | ≤ 7 rows, order `weekday`. Read via `fetchAllPages`. A missing weekday = shop closed; the seed has no Sunday row and the screens are built to say so. |
| POST | `/admin/shop-hours/` | admin-catalog | `['admin']` | object | 201. `{weekday, start_time, end_time}`. `weekday` unique across the table. |
| PATCH | `/admin/shop-hours/:id/` | admin-catalog | `['admin']` | object | `{start_time?, end_time?}`. |
| DELETE | `/admin/shop-hours/:id/` | admin-catalog | `['admin']` | 204 | Closes the shop for that weekday everywhere availability is computed. |
| GET | `/admin/time-off/` | admin-catalog | `['admin']` | paginated | The **whole table**, barber-specific rows and `barber_id: null` shop-wide closures alike; the console filters client-side. Order `-start_datetime`. `fetchAllPages`, twice (barber tab and the TimeOff page). |
| POST | `/admin/time-off/` | admin-catalog | `['admin']` | object | 201. `{barber: number\|null, start_datetime, end_datetime, reason?}` — **`null` means a shop-wide closure**. `start_datetime < end_datetime`. |
| DELETE | `/admin/time-off/:id/` | admin-catalog | `['admin']` | 204 | No past-start guard anywhere in the API. Pre-delete snapshot. |

**The hard ones.** The `barber_services` sub-resource: two path captures, a
cross-barber 404 scope, `null`-clears-vs-omitted-leaves semantics, and the
`!= null` effective-value rule that makes a `"0.00"` override real. The four
image/photo routes: two multipart uploads and two deletes that return a **body**
rather than 204, which is the opposite of every other `DELETE` in the mock.
`/admin/working-hours/` must paginate honestly: it is the canonical
`fetchAllPages` victim.

---

## 7. `admin-ops` — promotions, reviews, audit, analytics, settings, landing, notifications (26 routes)

| Method | Path pattern | Owner | auth | Envelope | Notes |
|---|---|---|---|---|---|
| GET | `/admin/promotions/` | admin-ops | `['admin']` | paginated | Order `-created_at`. Paged with `withPage`. Rows carry `uses_count` (read-only). |
| POST | `/admin/promotions/` | admin-ops | `['admin']` | object | 201. `{code, description?, percent_off?, amount_off?, valid_from?, valid_until?, max_uses?, is_active?}`. **Exactly one of `percent_off`/`amount_off`** — neither or both is 400 `validation_error`. `code` unique, matched case-insensitively. |
| PATCH | `/admin/promotions/:id/` | admin-ops | `['admin']` | object | Partial; re-validate the one-of rule against the **merged** row, not the body alone. `uses_count` is read-only. |
| DELETE | `/admin/promotions/:id/` | admin-ops | `['admin']` | 204 | Pre-delete snapshot into the audit row. |
| GET | `/admin/reviews/` | admin-ops | `['admin']` | paginated | `is_published` (`'true'`/`'1'` vs `'false'`/`'0'`, case-insensitive; anything else = no filter), `barber_id` (int; **malformed is ignored, not matched**), `rating` (int, same). Order `-created_at`. Hit two ways: `withPage(...)` for the moderation queue and `fetchAllPages('/admin/reviews/?is_published=true')` for the landing-page review picker. |
| POST | `/admin/reviews/:id/publish/` | admin-ops | `['admin']` | object | No body. Returns the review. Audit `review.publish` with `is_published` old→new. |
| POST | `/admin/reviews/:id/unpublish/` | admin-ops | `['admin']` | object | Mirror of the above. Note it can strand an id already sitting in `landing_content.featured_reviews`; `GET /landing/` filters unpublished ids out at read time, so do not mutate the singleton here. |
| DELETE | `/admin/reviews/:id/` | admin-ops | `['admin']` | 204 | The only destructive review op. Pre-delete snapshot into the audit payload. |
| GET | `/admin/audit/` | admin-ops | `['admin']` | paginated | `actor_id`, `action` (exact), `entity` (exact), `date_from`/`date_to` (Tbilisi date bounds on `created_at`). Also `?ordering=created_at\|-created_at`, default `-created_at`; no other ordering field is accepted. Append-only — no write route. |
| GET | `/admin/analytics/summary/` | admin-ops | `['admin']` | object | `?date_from=&date_to=` default to today-29 .. today; a reversed range is swapped; `?barber_id=` where `""`/`"null"`/malformed all read as "no filter". Same payload as the `summary` key of `/admin/analytics/barber/:barberId/` and both XLSX summary sheets — share the helper or the three will disagree. |
| GET | `/admin/analytics/revenue/` | admin-ops | `['admin']` | **bare array** | `[{date, revenue, count}]` — **completed bookings only**, one entry per day that has any, ascending by date. `revenue` is a decimal string. |
| GET | `/admin/analytics/bookings-by-status/` | admin-ops | `['admin']` | **bare array** | `[{status, count}]` over **all** statuses in range, ordered `-count`. |
| GET | `/admin/analytics/top-services/` | admin-ops | `['admin']` | **bare array** | `[{service_id, service_name, service_name_en, count, revenue}]`, completed only, `-count`, `?limit=` default **5**. |
| GET | `/admin/analytics/top-barbers/` | admin-ops | `['admin']` | **bare array** | `[{barber_id, first_name, last_name, count, revenue}]`, completed only, `-count`, `?limit=` default **5**. **Ignores `barber_id`** — upstream does not pass it through. |
| GET | `/admin/analytics/barber/:barberId/` | admin-ops | `['admin']` | object | `{barber_id, first_name, last_name, summary, revenue, by_status, top_services}` — the four blocks above, scoped to that barber, `top_services` limited to 10. Unknown barber → 404. The query string lands after this path's trailing slash. |
| GET | `/admin/analytics/export-xlsx/` | admin-ops | `['admin']` | **file** | `?date_from=&date_to=&barber_id=`. Unknown `barber_id` → 404 **before** the audit row is written. Same writer (`demo/xlsx.ts`), with the `[12, 40]` width clamp instead of the row exports' `[10, 50]`. Multi-sheet workbook (summary, daily revenue, by status, top services, top barbers; per-barber summaries when no `barber_id`). Audit `analytics.export`. |
| GET | `/admin/settings/` | admin-ops | `['admin']` | paginated | Upstream splits read from write (`_ReadStaff_WriteFeature`); with one console role the GET and the three writes gate alike. Order `key`. `value` is arbitrary JSON. `fetchAllPages` — the Settings page indexes by `key` and must see every row. |
| POST | `/admin/settings/` | admin-ops | `['admin']` | object | 201. `{key, value, description?}`. `key` unique. Mirror whatever `admin/pages/admin/Settings.tsx` round-trips, including `sms_notifications_enabled`'s falsy-string set. |
| PATCH | `/admin/settings/:id/` | admin-ops | `['admin']` | object | `{value, description?}` — the key is not editable through this path. A row holding JSON `null` reads back as absent to `getSetting()`. |
| DELETE | `/admin/settings/:id/` | admin-ops | `['admin']` | 204 | Deleting a booking knob restores its static default (15 / 30 / 60 / 2); deleting `sms_notifications_enabled` re-enables SMS. |
| GET | `/admin/landing/` | admin-ops | `['admin']` | **object** | The **singleton, returned from the list route** — not an array, not an envelope. Fields: the eight content columns plus `featured_review_ids: number[]` and `updated_at`. |
| PATCH | `/admin/landing/:id/` | admin-ops | `['admin']` | object | The client always sends `/admin/landing/1/`; **the pk is ignored — always operate on the singleton**. Body is a partial of the same fields; `featured_review_ids` may only contain **published** review ids (400 `validation_error` otherwise). Audit `landing.update` with an old→new diff, rendering `featured_review_ids` as sorted arrays on both sides. |
| GET | `/admin/notification-templates/` | admin-ops | `['admin']` | paginated | All 16 rows (4 keys × 2 channels × 2 languages), ordered `key, channel, language`. `fetchAllPages`. |
| PATCH | `/admin/notification-templates/:id/` | admin-ops | `['admin']` | object | `{subject?, body?, is_active?}`. SMS rows keep `subject: ""`. |
| POST | `/admin/notification-templates/preview/` | admin-ops | `['admin']` | object | `{subject?, body}` → `{subject, body}` rendered against a fixed sample context. A template syntax error is a **400 with `{error: string}`** — the one route in the mock that does not use the `{code, message, field}` envelope. Literal `preview` beats the `:id` capture. |
| POST | `/admin/notification-templates/:id/test-send/` | admin-ops | `['admin']` | object | `{recipient}` (phone for SMS rows, email for email rows). If the row is SMS and `smsNotificationsEnabled()` is false → **409 `sms_disabled`**, and the attempt is still audited with `success: false`. Otherwise append a `notification_logs` row and return `{detail, rendered: {body, subject?}}` — `subject` only for email. Audit `notification.test_send` for both outcomes. |

**The hard ones.** `/admin/landing/` — a list route that returns an object, and a
detail PATCH whose pk is a lie. The seven analytics routes are five different
shapes (object, four bare arrays, object, file) sharing one date-range parser,
and `summary` must agree digit-for-digit with the `summary` block inside
`/admin/analytics/barber/:barberId/` and with both XLSX summary sheets.
`/admin/notification-templates/preview/` is the one route in the mock that does
not answer errors in the `{code, message, field}` envelope.

---

## 8. Module totals

| Module | Routes | Bare arrays | Files | Multipart |
|---|---|---|---|---|
| `auth` | 9 | — | — | — |
| `public` | 2 | — | — | — |
| `barbers` | 3 | — | — | — |
| `bookings` | 4 | — | — | — |
| `admin-bookings` | 17 | — | 2 | — |
| `admin-catalog` | 32 | 2 | — | 2 |
| `admin-ops` | 26 | 4 | 1 | — |
| **Total** | **93** | **6** | **3** | **2** |

The six bare arrays are exactly the exceptions listed in `schema.md` §7.1:
`GET /admin/barbers/`, `GET /admin/barbers/:id/services/` and the four
list-shaped `GET /admin/analytics/*` (`revenue`, `bookings-by-status`,
`top-services`, `top-barbers`). **Everything else under `/admin/` is paginated.**
`GET /admin/landing/`, `GET /admin/analytics/summary/` and
`GET /admin/analytics/barber/:barberId/` are objects, not arrays.

---

## 9. Served upstream, deliberately **not** registered

Nothing in either ported front end calls these. Registering them costs handler
authors time and invites drift; the router answering 404 is the correct outcome
if one ever appears.

| Route(s) | Why not |
|---|---|
| Everything under `/api/barber/me/` (`urls_me.py`) — `schedule/`, `analytics/` and the three `time-off/` routes | **There is no barber surface.** `admin` is the only role the console admits, so `barber` survives only as the data tag on the user rows behind the `barbers` table: nobody signs in as one and no page would call these. The staff lifecycle actions the barber's schedule used (`POST /api/bookings/:id/complete/` and `no-show/`) went with them — the console drives a booking's status through `/admin/bookings/:id/` instead. |
| `GET /api/admin/permissions/`, `PATCH /api/admin/permissions/bulk/` | **There is no permission table.** With `admin` the only console role, and admin bypassing `HasFeaturePermission` in code, every flag was dead and the matrix would have rendered a single meaningless `customer` column. The `feature_permissions` table, the `feature` route option and `hasFeature()` are all gone with them. |
| `GET /api/reviews/`, `POST /api/reviews/` | **Neither front end calls them.** The customer app has no review UI at all — no writing, and since the landing band was dropped, no reading. The `reviews` table still exists and the admin moderation queue still reads it — but through `/admin/reviews/`. This is the only whole backend app with no route in the mock, and the reason `public` owns two routes rather than four. |
| `GET /api/admin/bookings/:id/` | The console never fetches a single booking; the detail drawer renders the row it already holds from the list. |
| `GET` retrieve on `/admin/services/:id/`, `/admin/service-categories/:id/`, `/admin/promotions/:id/`, `/admin/reviews/:id/`, `/admin/users/:id/`, `/admin/audit/:id/`, `/admin/settings/:id/`, `/admin/notification-templates/:id/`, `/admin/working-hours/:id/`, `/admin/shop-hours/:id/`, `/admin/time-off/:id/` | Every one of these lists is read whole (`fetchAllPages`) or paged, and the UI edits from the row in hand. Only `/admin/barbers/:id/` and `/admin/customers/:id/` are genuinely fetched, and both are registered. |
| `PUT` on every ModelViewSet | Both seams expose `patch` only; there is no `api.put`. |
| `PATCH /api/admin/time-off/:id/` | The TimeOff page creates and deletes; it never edits. |
| `POST` / `DELETE` on `/admin/notification-templates/` | The Notifications page edits the 16 seeded rows and can neither add nor remove one. |
| `GET /api/healthz/`, `GET /api/readyz/` | Infrastructure probes. Nothing in the browser calls them. |
| `GET /api/schema/`, `GET /api/docs/`, `/admin/` (Django) | DECISIONS §2 — not registered. |
| DRF router index routes (`GET /api/admin/`), `.json` format suffixes | Same ruling. |
| Any specialty CRUD | DECISIONS §10 — **no such endpoint exists upstream**, and `admin/pages/admin/BarberDetail.tsx` only ever *renders* `barber.specialties`. Specialties are seeded and inlined into the barber payloads; do not invent a route for them. |
| Anything under `/media/` | Served from the bundle. `serialize.mediaUrl()` builds the URL; no route is involved. |

---

## 10. Reconciliation flags

**No call site is missing a route.** Every path either front end can construct
resolves to a row above. Four near-misses are worth stating explicitly, because
each looks like a bug and is not:

1. **`PATCH /admin/landing/1/`** — the `1` is hard-coded in `cms-hooks.ts:95` and
   the backend ignores it. Register `/admin/landing/:id/` and ignore the capture.
   Do **not** register `/admin/landing/1/` literally.
2. **`/admin/analytics/barber/${barberId}/${qs(range)}`** — the query string lands
   *after* the id's trailing slash. That is a normal path + query, not a nested
   segment: `/admin/analytics/barber/:barberId/`.
3. **`fetchAllPages('/admin/barbers/')`** on a bare-array route — `toPaginated()`
   wraps an array with `next: null`, so the loop stops after one call. Correct as
   written; do **not** "fix" it by paginating the route.
4. **`GET /admin/bookings/export-xlsx/` with no dates** — `downloadBookingsXlsx`
   passes whatever filters the page holds, so an export with no date range is
   reachable from the UI and *must* answer 400 `export_range_required`. That is
   upstream behaviour, not a missing precondition.

Two things genuinely need a decision from the seam author rather than a handler
author, and are recorded here so they are not lost:

- **`POST /auth/refresh/`** is registered, but only `admin/lib/api.ts` calls it,
  from `refreshSession()` — which today uses a raw `fetch`. That call must be
  routed through `dispatch` along with the rest of the seam, or it will attempt a
  real network request and violate rule 1. The route's job is to fail (401) when
  signed out, which is what produces the redirect to the console login.
- **`apiDownload`** must unwrap the `file(blob, filename)` reply itself. The three
  XLSX routes are the only ones that return one.

One divergence from upstream is deliberate and belongs in the handlers, not the
seed: **`autoCompleteStaleBookings()` runs on every dispatch** (DECISIONS §22), so
any route above may observe a booking that changed status since the previous call.
Read `store.x` at call time; never hoist.
