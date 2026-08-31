# The demo database

The contract every handler and every seed file codes against. `store.js` builds this
from `./seed/*.json`; `handlers/*` read it and write it; `serialize.js` turns rows into
API payloads.

## Rows are rows, not payloads

These are the shapes **Postgres held**, not the shapes DRF returned. Anything a
serializer computed belongs to the handler modules, not here:

`status_display`, `urgency_display`, `full_name`, `display_name`, every `*_detail`
expansion, `image_count`, `is_cancellable`, `is_busy`, `active_orders_count`,
`vehicles_count`, `image_url` / `avatar_url` / `document_url` / `photo` absolute URLs,
`categories_detail`, `car_categories` as nested objects, the whole of
`/auth/admin/dashboard/` and `/auth/admin/analytics/`, and every car-owner metric.

## Conventions

| Thing | Convention |
|---|---|
| Foreign key | `<field>_id`, a number or `null`. `Order.assigned_vehicle` → `assigned_vehicle_id`. |
| Many-to-many | `<field>_ids`, an array of numbers, owned by the side Django owns it on. |
| Decimal column | A **string** at the model's precision (`'12.50'`, `'0.015000'`, `'0.1800'`). `COERCE_DECIMAL_TO_STRING` is on upstream, so a float here would render as `12.5` where the real app rendered `12.50`. |
| Money that is an integer column | A real number. Only `Order.price` (`PositiveIntegerField`). |
| Timestamp | ISO-8601 string with an offset, e.g. `'2026-08-24T09:12:00+04:00'`. |
| Date column | `'YYYY-MM-DD'`. Time column: `'HH:MM:SS'` — DRF's `TimeField` emits seconds and the UI slices to 5 chars. |
| Multilingual JSONField | `{en, ka, ru}`. All three keys present, all three filled, unless a row is deliberately exercising the `field[lang] \|\| field.en` fallback. |
| Image / file field | A **bare path** under `public/media/` (`'vehicles/tw-101-a.jpg'`), or `null`. Never a URL — `demo/base.js:mediaUrl()` builds those, so the seed survives a change of base path. After an upload the same field holds an `blob:` object URL instead; `mediaUrl()` passes those through untouched. |
| Blank vs null | Django `CharField(blank=True)` is `''`, never `null`. `null` is reserved for genuinely nullable columns. The one trap: `User.personal_id` is `null` for company accounts, **not** `''` — it is `unique`, and Postgres treats NULLs as distinct while it would reject a second `''`. |
| Brand | Tonnaro, `tonnaro.ge`, `hello@tonnaro.ge`, `+995 322 55 07 40`, accent theme key `orange`. Every person, company, driver and owner name is invented. |

## ID ranges

Every table gets its own band. Ids only have to be unique per table, but keeping the
bands disjoint means a cross-table typo (a driver id where a vehicle id was meant)
resolves to nothing instead of silently resolving to the wrong row. `nextId()` continues
from each table's highest seeded id, so leave the headroom shown.

| Table | Band | Seeded |
|---|---|---|
| `users` | 1–99 | 12 |
| `companyContracts` | 101–199 | 9 |
| `verificationTokens` | 201–299 | 2 |
| `categories` | 300–399 | 19 |
| `restrictedTimeWindows` | 400–499 | 5 |
| `services` | 500–599 | 18 |
| `carOwners` | 600–699 | 10 |
| `vehicles` | 700–799 | 18 |
| `vehicleImages` | 800–899 | 18 |
| `drivers` | 900–999 | 18 |
| `orders` | 1000–1199 | 29 |
| `orderImages` | 2000–2099 | 14 |
| `orderStatusHistory` | 2100–2599 | ~80 |
| `orderEditHistory` | 2600–2699 | 9 |
| `pricingZones` | 2700–2749 | 6 |
| `pricingRates` | 2750–2849 | 15 |
| `pricingElevation` | 2850–2869 | 4 |
| `pricingPumpMixer` | 2870–2879 | 2 |
| `pricingEquipment` | 2880–2899 | 7 |
| singletons | `id: 1` | `pricingConfig`, `landingSettings`, `siteSettings`, `seoSettings` |

`orders` is the one band two authors will both write into: **1000–1099 is the primary
demo customer's**, 1100–1199 is everyone else's.

---

## users

`seed/users.json` · backend `accounts.User`

| Field | Type | Note |
|---|---|---|
| `id` | number | |
| `email` | string | Unique. Every lookup upstream is `email__iexact`; match that. |
| `password` | string | **Plain text.** Compared literally by the login handler. Never serialized. |
| `phone_number` | string | Exactly `+995XXXXXXXXX` (13 chars). `PhoneInput` strips a leading `995` and slices to 9 digits, so anything else renders truncated and fails re-validation. May be `''`. |
| `user_type` | `'personal' \| 'company'` | |
| `company_name` | string | `''` for personal. |
| `company_id` | string | `''` or exactly 9 digits. |
| `personal_id` | string \| null | Exactly 11 digits and unique, or `null` for company accounts. Never `''`. |
| `first_name`, `last_name` | string | Both required — the layouts render `first_name[0]` as the avatar initial. |
| `avatar` | string \| null | Media path. |
| `role` | `'customer' \| 'admin'` | |
| `is_active` | boolean | |
| `is_staff` | boolean | true only on the admin. |
| `email_verified` | boolean | **Gates login.** False dead-ends the demo on the code screen. |
| `must_change_password` | boolean | Outranks `role` in every route guard. |
| `accepted_terms_at` | ISO \| null | |
| `last_login` | ISO \| null | |
| `created_at`, `updated_at` | ISO | `Meta.ordering = ['-created_at']`. |

**Relations** → `orders.user_id`, `companyContracts.user_id`, `verificationTokens.user_id`
(all CASCADE), `companyContracts.uploaded_by` and `orders.admin_edited_by` /
`orderStatusHistory.changed_by` / `orderEditHistory.changed_by` (all SET_NULL).

**Seed** — 12 rows: 1 admin, 7 personal customers, 4 company customers.

The two accounts the demo banner signs people in with are pinned in
[`demo/accounts.js`](./accounts.js) and this file must match it exactly:
`id: 1` is `admin@tonnaro.ge` (`role: 'admin'`, `is_staff: true`) and `id: 2` is
`demo@tonnaro.ge`, the primary customer who owns 15 orders. Both take the password
`accounts.js` exports. Every other user exists as data only — they own orders and appear in
the admin list, but nothing offers a way in, which is the arrangement the real product has.

`email_verified: true` on all but one. Exactly one `must_change_password: true`, exactly one
`email_verified: false`, exactly one `is_active: false` — none of them `id: 1` or `id: 2`,
or the demo's own front door stops working. 2–3 with an avatar. Personal rows carry 11
distinct digits in `personal_id`; company rows carry 9 in `company_id` and
`personal_id: null`.

## companyContracts

`seed/company-contracts.json` · backend `accounts.CompanyContract`

`id` · `user_id` · `document` (media path) · `title` string · `original_filename` string ·
`file_size` number (bytes) · `uploaded_by` number \| null · `created_at` ISO.

**Seed** — 9 rows across 2 company users (2–4 each), one company user with **zero** so the
empty state renders. `file_size` between 80 000 and 4 000 000 so `formatBytes` shows both
KB and MB. `uploaded_by` = the admin. Personal users must resolve to `[]`.

## verificationTokens

`seed/verification-tokens.json` · backend `accounts.EmailVerificationToken`

`id` · `user_id` · `purpose` `'verify_email' | 'password_reset'` · `code` string (6 digits)
· `token` string (magic-link token) · `expires_at` ISO · `used_at` ISO \| null · `attempts`
number · `created_at` ISO · `last_sent_at` ISO.

Upstream stores SHA-256 hashes of `code` and `token`. Here they are **plain text**, because
there is no email in a browser tab and the demo has to be able to show the code.

**Seed** — 2 rows, both unused: a `verify_email` for the unverified user with code
`'123456'`, and a `password_reset` for the primary customer with code `'654321'`.
`store.js` re-arms every unused row against the real clock at construction (10 min for
verify, 30 for reset), so the seeded `expires_at` only has to be internally sane.

## categories

`seed/categories.json` · backend `categories.TransportCategory`

`id` · `name` `{en,ka,ru}` · `slug` string (unique) · `description` `{en,ka,ru}` · `icon`
string · `image` path \| null · `image_webp` path \| null · `color` string · `is_active`
boolean · `is_helper_card` boolean · `position` number · `suggestion_keywords` string (CSV)
· `pricing_mode` `'fixed' | 'calculator'` · `fixed_price` decimal string · `pricing_type`
`'' | 'hiab' | 'trailer' | 'cart'` · `created_at` · `updated_at`.

- `icon` must be a key in `utils/categoryIcons.js` `ICON_DEFS` (145 of them). Upstream's own
  seed used `'question'` for the helper card, which is **not** in the set and renders as a
  car — don't copy that bug; use `'minus'` or `'info-circle'`.
- `color` must be 6-digit hex. Cards concatenate `'12'` / `'14'` alpha suffixes onto it.
- `image_webp` exists because only `TransportCategory` gets a generated `.webp` companion
  upstream. It lets the serializer emit `image_webp_url` honestly without probing storage.
  `null` on a row exercises `PictureImage`'s plain-`<img>` path.
- `position` is unique and `0..N-1`; `Meta.ordering = ['position', 'name']`.
- `is_helper_card` is a hard singleton: exactly one row true, read-only, undeletable.

**Seed** — 19 rows: 16 active, 1 helper card, 2 archived (`is_active: false`). Pricing:
~10 `fixed` with `fixed_price` `'80.00'`–`'900.00'`, ~5 `calculator` with `pricing_type`
spread over `hiab`/`trailer`/`cart` (every value must have rate rows for every active zone,
or the calculator 404s). Helper card is `fixed` / `'0.00'`. Keep one or two rows with only
`en` filled so the language fallback is visible. At least 9 active rows or the landing
page's "show N more" toggle never appears.

## restrictedTimeWindows

`seed/restricted-time-windows.json` · backend `categories.RestrictedTimeWindow`

`id` · `category_id` · `location_keyword` string · `start_time` `'HH:MM:SS'` (inclusive) ·
`end_time` `'HH:MM:SS'` (exclusive, may wrap past midnight) · `description` string ·
`is_active` boolean · `created_at` · `updated_at`.

Nested inside the category payload both ways: the public serializer emits only
`is_active: true` rows, and an admin PATCH **reconciles** — rows with a known id are
updated, rows without are created, and any existing row whose id is absent is deleted.

**Seed** — 5 rows on 3 categories (crane, concrete mixer, dump truck). One wraps midnight
(`'22:00:00'`→`'06:00:00'`), one is `is_active: false`, one has a blank `description` (the
backend synthesises the message). Keywords: `'Tbilisi'`, `'თბილისი'`, `'Batumi'`.

## services

`seed/services.json` · backend `services.Service`

`id` · `name` `{en,ka,ru}` · `slug` · `description` `{en,ka,ru}` · `icon` · `image` path \|
null · `color` · `car_category_ids` number[] · `requires_destination` boolean · `is_active`
· `is_helper_card` · `position` · `floor_max` number · `floor_price` number · `days_max`
number · `cargo_field_config` object · `suggestion_keywords` string · `created_at` ·
`updated_at`.

`cargo_field_config` always carries all ten keys — `length`, `width`, `height`, `volume`,
`weight`, `floor`, `days`, `fragile`, `insured`, `insurance` — each `'off' | 'optional' |
'required'`. Defaults: the five dimensions/weight `'optional'`, the other five `'off'`.

No `image_webp` — `Service` has no webp companion and `ServicePublicSerializer` has no
`image_webp_url` field at all.

**Seed** — 18 rows: 16 active, 1 helper, 1 archived. One per category, plus 3–4 spanning
2–3 categories so the tag column overflows to `+N`. 8 with `requires_destination: true`
(the transport ones), 8 false (on-site crane / excavator / forklift work, which is what
makes the wizard render its single "work location" column). Vary `cargo_field_config`: a
couple with `floor: 'required'` + `floor_price` 40–120, a couple with `days: 'optional'` +
`days_max: 14`, one with everything `'off'` except `weight`. 8–12 comma-separated
`suggestion_keywords` per row or `/services/suggest/` returns nothing.

## carOwners

`seed/car-owners.json` · backend `car_owners.CarOwner`

`id` · `owner_type` `'personal' | 'company'` · `first_name` · `last_name` · `personal_id`
(`''` or 11 digits) · `company_name` · `company_id` (`''` or 9 digits) · `phone` · `email`
· `address` · `notes` · `is_active` · `created_at` · `updated_at`.

Note the asymmetry with `users`: here the unused id field is `''`, not `null`, because
`CarOwner`'s columns are `blank=True` and not unique.

**Seed** — 10 rows: 5 company, 5 personal, 1–2 `is_active: false`, 2 with **no vehicles**
so the empty drilldown renders, and 1 whose vehicles have no active orders so the activity
filter has both buckets.

## vehicles

`seed/vehicles.json` · backend `vehicles.Vehicle`

`id` · `name` string · `category_ids` number[] · `plate_number` string (unique) · `year`
number \| null · `capacity` decimal string \| null (tonnes, `'12.50'`) · `description`
string · `license_categories` string (CSV of `A1 A B1 B BE C1 C1E C CE D1 D1E D DE T S`) ·
`image` path \| null · `status` `'available' | 'in_use' | 'maintenance' | 'retired'` ·
`is_active` boolean · `owner_id` number \| null · `created_at` · `updated_at`.

`capacity` is a **number as a string**, not `'10 tons'` — the admin table prints
`` `${capacity} t` ``.

**Seed** — 18 rows. Status: 13 `available`, 2 `in_use`, 1 `maintenance`, 1 `retired`, 1
`is_active: false`. `category_ids` never empty (an empty one renders no row thumbnail).
Every `owner_id` points at a real owner. Plates in the `XX-NNN` shape. **A vehicle whose
status is `available` must not hold an order in `ACTIVE_STATUSES`** — upstream's
`sync_vehicle_status` keeps those two in step and a seed that contradicts it is internally
inconsistent.

## vehicleImages

`seed/vehicle-images.json` · backend `vehicles.VehicleImage`

`id` · `vehicle_id` · `image` path · `order` number · `is_primary` boolean · `created_at`.

Ordering is `['-is_primary', 'order', 'created_at']` — primary first. Hard cap of 5 per
vehicle. **At most one `is_primary: true` per vehicle**, and deleting the primary promotes
the next row in that ordering.

**Seed** — 18 rows over 6 vehicles: one vehicle with the full 5 (so the "add photos" button
renders disabled), the rest 2–4, and a dozen vehicles with none so the icon fallback shows.

## drivers

`seed/drivers.json` · backend `drivers.Driver`

`id` · `first_name` · `last_name` · `phone` · `email` (may be `''`) · `license_number`
string (unique) · `license_categories` string (CSV) · `license_expiry` `'YYYY-MM-DD'` \|
null · `date_of_birth` \| null · `hire_date` \| null · `photo` path \| null · `notes`
string · `status` `'active' | 'on_leave' | 'inactive'` · `is_active` boolean ·
`vat_18_percent` boolean · `vehicle_ids` number[] · `created_at` · `updated_at`.

- `license_categories` must be a **superset** of every linked vehicle's. Both the client
  dropdown filter and `DriverDetailSerializer.validate()` enforce it; violate it and
  vehicles silently vanish from the driver form.
- `vehicle_ids` must be non-empty on any driver you want assignable — the admin order page
  computes eligibility client-side from that array.
- `vat_18_percent` selects the 18% vs 1% driver tier in the pricing engine, so changing a
  driver is a price-affecting edit.

**Seed** — 18 rows (see the pagination note below for why not 30). ~70% `active`, ~20%
`on_leave`, ~10% `inactive`; 2–3 `is_active: false`; half with a photo; ~80%
`vat_18_percent: true`; 8 of them holding an active order.

## orders

`seed/orders.json` · backend `orders.Order`

| Field | Type | Note |
|---|---|---|
| `id` | number | Rendered as `#1042` in both UIs. |
| `public_id` | string | UUIDv4. Customer navigation uses `public_id \|\| id`, and every customer route resolves **either**. |
| `user_id` | number | |
| `suggested_service_id`, `selected_service_id`, `final_service_id` | number \| null | |
| `suggested_category_id`, `selected_category_id`, `final_category_id` | number \| null | Legacy, but the list serializer still falls back service → category, so both must resolve. |
| `assigned_vehicle_id`, `assigned_driver_id` | number \| null | |
| `scheduled_from`, `scheduled_to` | ISO \| null | The one pair of timestamps that legitimately points into the future. |
| `pickup_location` | string | |
| `pickup_lat`, `pickup_lng` | number \| null | |
| `destination_location` | string | `''` for a non-transport job. |
| `destination_lat`, `destination_lng` | number \| null | |
| `requested_date` | `'YYYY-MM-DD'` | Rendered raw. |
| `requested_time` | `'HH:MM:SS'` \| null | Rendered raw, so it visibly shows `09:00:00`. Seconds must be `00` or the list's time filter can never match. |
| `contact_name`, `contact_phone` | string | |
| `description` | string | |
| `cargo_details` | string | Human-readable summary, e.g. `'2.4 × 1.2 × 1.8 m'`. |
| `cargo_weight_kg` | decimal string \| null | **Kilograms.** The wizard's input says tonnes and multiplies by 1000 before sending. |
| `cargo_days`, `cargo_floor` | number \| null | |
| `cargo_fragile`, `cargo_insured`, `cargo_insurance` | boolean | |
| `pricing_breakdown` | object \| null | See below. Every numeric inside is a **string**. |
| `admin_verified_service` … `_category` `_vehicle` `_driver` `_price` | boolean | Five independent checkmarks. |
| `urgency` | `'low' \| 'normal' \| 'high' \| 'urgent'` | |
| `status` | see the flow below | |
| `admin_comment`, `user_note` | string | |
| `price` | number \| null | Positive **integer**, GEL. The engine rounds the exact decimal up to the next multiple of 10 for this column while `pricing_breakdown.total` keeps the unrounded value — they legitimately disagree. |
| `customer_accepted_at` | ISO \| null | |
| `route_stops` | **string** | A JSON string, or `''`. See below. |
| `is_read_by_admin`, `is_read_by_customer` | boolean | The demo's whole notification-read surface — there is no separate reads table. |
| `last_event_at` | ISO | The max of this across the viewer's orders is `latest_event_at`, and a forward move in it is the **only** thing that drives the live refresh on five pages. |
| `last_event_type` | string | `'created' \| 'cancelled' \| 'images_added' \| 'edited' \| 'updated' \| 'status:<status>'`. The admin notification sound fires only for the customer-origin four. |
| `admin_edited_at` | ISO \| null | Drives the amber "Edited by admin" badge. |
| `admin_edited_by` | number \| null | |
| `created_at`, `updated_at` | ISO | `Meta.ordering = ['-created_at']`. |

### `route_stops`

Stored as the **JSON string** Django's `TextField` held, because the asymmetry is
load-bearing: `OrderDetailSerializer` `json.loads`es it into an object on read, and an
admin PATCH sends it back as a string. `''` means absent.

```json
{
  "pickups":      [{"address": "…", "lat": 41.7, "lng": 44.8, "contact_name": "…", "contact_phone": "…"}],
  "destinations": [{"address": "…", "lat": 41.6, "lng": 41.6, "contact_name": "",  "contact_phone": ""}],
  "distance": 231000,   // METRES
  "duration": 17800,    // SECONDS
  "ascent": 640         // METRES
}
```

`pickups[0]` mirrors the flat `pickup_*` + `contact_*` fields; `destinations[0]` mirrors
`destination_*`. **Compute `distance`/`duration`/`ascent` by calling
`routeSummaryFor(coords)` from `demo/routing.js`** with the same coordinate list. If the
seeded numbers disagree with what `/orders/route-profile/` synthesises for those coords,
the admin detail page's drift sync silently re-prices the order the moment anyone opens it.

### `pricing_breakdown`

```
fixed:      {mode:'fixed', base, days_multiplier:int, floor_surcharge, total}
calculator: {mode:'calculator', type, zone, weight_kg, effective_weight_kg, distance_km,
             elevation_m, days_multiplier:int, floor_surcharge, total, breakdown:{…}}
errors:     {mode:'unknown', error:'no_category'}
            {mode:'calculator', error:'missing_pricing_type'}
            {mode:'calculator', error:'no_rate_for_type_zone', type, zone}
```

Every value except `days_multiplier` and `breakdown.min_kg` is a string. The nested
`breakdown` carries `rate` (the whole rate row), `gradient`, `elevation_multiplier`,
`fuel_per_km`, `min_kg`, `effective_weight_kg`, `weight_min_applied`, `weight_revenue`,
`distance_revenue`, `fixed_revenue`, `total_revenue`, `company_fee`, `driver_gross`,
`fuel_cost`, `profit_before_vat`, `vat`, `vat_rate`, `driver_vat`, `driver_vat_rate`,
`driver_net`, `warnings[]`.

### Status flow

```
new → under_review → offer_sent → approved → in_progress → completed
                  ↘ rejected                                (terminal)
new / under_review / offer_sent → cancelled                 (customer only)
```

`STATUS_PROGRESSION`, `CANCELLABLE_STATUSES` (`new`, `under_review`, `offer_sent`),
`ACTIVE_STATUSES` (`offer_sent`, `approved`, `in_progress` — these hold a vehicle and a
driver) and `RELEASED_STATUSES` (`completed`, `rejected`, `cancelled` — terminal, every
write 400s) are exported from `store.js`.

**Seed** — 29 rows, so page 2 of `/orders/admin/` exists. Status spread: `new` ×4,
`under_review` ×5, `offer_sent` ×4, `approved` ×3, `in_progress` ×3, `completed` ×6,
`rejected` ×2 (each with a non-empty `admin_comment`), `cancelled` ×2. Then:

- `price` is `null` on every `new` / `under_review` row and a positive integer on every
  `offer_sent` / `approved` / `in_progress` / `completed` row. A priced `new` order shows
  the wrong card; an unpriced `offer_sent` order kills the Accept button.
- `customer_accepted_at` set on `approved` / `in_progress` / `completed`, `null` on
  `offer_sent`.
- Vehicle **and** driver assigned on every `approved` / `in_progress` / `completed` row;
  both `null` on `new` / `under_review` / `offer_sent`, except 2 `under_review` rows that
  are fully assigned with all five `admin_verified_*` true (so the sticky "send for
  approval" bar is enabled) and one with 4 of 5 (so the amber missing-verifications list
  renders).
- 4–6 unread by admin (`is_read_by_admin: false`) with recent `last_event_at`, their
  `last_event_type` spanning `created`, `images_added`, `cancelled`, `status:approved`.
  2–3 unread by customer.
- 4–6 with `scheduled_from`/`scheduled_to`, two of them deliberately overlapping on the
  same vehicle so the booking-conflict error is reachable.
- 3–4 multi-stop (2 pickups and/or 2 destinations with per-stop contacts); at least one
  against a `requires_destination: false` service so the single-address layout renders.
- ~60% `calculator` breakdowns (1–2 with `effective_weight_kg` ≠ `weight_kg`), ~25%
  `fixed` (one with `days_multiplier > 1`, one with `floor_surcharge > 0`), 2 error rows.
- 1–2 with `admin_edited_at` + `admin_edited_by`.
- Urgency mostly `normal` with at least one `high` and one `urgent`.
- Owner spread: the primary customer (`user_id: 2`) owns 15 covering every status; the rest
  spread over 4–5 other customers.

`store.js` nudges `requested_date` after rebasing — see below — so the seed only has to
put dates in a plausible spread; it does not have to hit "3 today" itself.

## orderImages

`seed/order-images.json` · `id` · `order_id` · `image` path · `created_at`.

**Seed** — 14 rows over 5 orders (2–4 each). One of those orders must also be
admin-unread with `last_event_type: 'images_added'`.

## orderStatusHistory

`seed/order-status-history.json` · backend `orders.OrderStatusHistory`

`id` · `order_id` · `old_status` string (`''` on the creation row) · `new_status` string ·
`changed_by` number \| null · `comment` string · `created_at` ISO · `is_auto_promotion`
boolean.

**Write the rows oldest-first** — it reads better and `statusHistoryForOrder()` reverses
them. `Meta.ordering` is `['-created_at']` and the UI renders array order top-to-bottom,
so the serializer must emit **newest first**.

**Seed** — 2–5 per order, ~80 total. First row is always `{old_status: '', new_status:
'new', comment: 'Order created'}` by the customer. `created_at` strictly increasing and
spread over days, not seconds. Human comments: an admin note on `offer_sent`, `'Customer
accepted the price offer'` on `approved`, `'Cancelled by customer: <reason>'` or `'Offer
rejected by customer: <reason>'` on `cancelled`, a reason on `rejected`.

**Do not seed an `is_auto_promotion: true` row.** The undo banner arms only when
`status_history[0].is_auto_promotion && status === 'under_review' && now - created_at <
60s`, so a seeded one is dead data — the handler has to create that row at GET time when it
flips a `new` order to `under_review`.

## orderEditHistory

`seed/order-edit-history.json` · backend `orders.OrderEditHistory`

`id` · `order_id` · `field_name` string · `old_value` string · `new_value` string ·
`changed_by` number \| null · `changed_at` ISO. Ordering `['-changed_at']`.

`field_name` is one of the 14 customer-provided fields: `pickup_location`, `pickup_lat`,
`pickup_lng`, `destination_location`, `destination_lat`, `destination_lng`,
`requested_date`, `requested_time`, `contact_name`, `contact_phone`, `description`,
`cargo_details`, `urgency`, `route_stops`. Values are `str()` of the model value, so a
`route_stops` row's old/new are whole JSON strings.

**Seed** — 9 rows over 3 orders (2–4 each), including one `route_stops` row. Those orders
must also carry `admin_edited_at`.

## pricingConfig

`seed/pricing-config.json`, a single object · `id: 1` · `vat` decimal string (`'0.1800'`) ·
`updated_at`.

## pricingZones

`seed/pricing-zones.json` · backend `pricing.Zone`

`id` · `slug` string (unique, ≤40, locked after create) · `name` `{en,ka,ru}` · `kind`
`'keyword' | 'distance'` · `keywords` string (CSV) · `keyword_scope` `'within' |
'crossing'` · `max_distance_km` number \| null · `order` number · `is_active` boolean ·
`updated_at`.

`PricingRate.zone` holds this **slug as a plain string** — there is no FK, so deleting a
zone orphans its rates and the rates table falls back to rendering the raw slug.

**Seed** — 6 rows in explicit `order`: `0` Tbilisi (keyword, `within`), `1` leaving Tbilisi
(keyword, `crossing`), `2` up to 30 km (distance, 30), `3` up to 100 km (distance, 100),
`4` regional (distance, `max_distance_km: null` — the catch-all), plus one `is_active:
false` legacy slug that an old order's `pricing_breakdown` still names, so the
fallback-to-raw-slug path is visible.

## pricingRates

`seed/pricing-rates.json` · backend `pricing.PricingRate`

`id` · `type` `'hiab' | 'trailer' | 'cart'` · `zone` string (a slug) · `min_fix` · `per_kg`
(6 dp, **per kilogram** — the form shows per-tonne and multiplies by 1000) · `max_kg`
number · `min_kg` number · `per_km` · `fixed_price` · `fixed_radius` number · `fee_pct`
(0–1) · `km_fix` · `fuel_per_km` · `updated_at`. Decimals are strings. Unique on
`(type, zone)`.

**Seed** — 15 rows: all 3 types × the 5 active zones, so no dropdown pair 404s. `min_fix`
120–400, `per_kg` `'0.010000'`–`'0.045000'`, `max_kg` 8000–50000, `min_kg` 0 except two
rows at 3000–5000 (so `weight_min_applied` fires), `per_km` 1.2–3.5, `km_fix` 2–8,
`fuel_per_km` `'1.2600'`, `fee_pct` `'0.1500'`–`'0.2500'`, `fixed_radius` 0 except two at
30 (so `distance_exceeds_fixed_radius` fires).

## pricingElevation

`seed/pricing-elevation.json` · backend `pricing.ElevationBucket`

`id` · `max_gradient` decimal string \| null (m/km, inclusive upper bound; `null` is the
open-ended top bucket) · `multiplier` decimal string · `order` number.

**Seed** — 4 rows: `'5.0000'`→`'1.0000'`, `'15.0000'`→`'1.1000'`, `'30.0000'`→`'1.2500'`,
`null`→`'1.5000'`.

## pricingPumpMixer

`seed/pricing-pump-mixer.json` · `id` · `kind` `'pump' | 'pump_mixer'` (unique) · `per_m3`
· `fixed` · `max_m3` number. **Seed** — both rows; at most 2 can ever exist.

## pricingEquipment

`seed/pricing-equipment.json` · backend `pricing.EquipmentItem`

`id` · `name` `{en,ka,ru}` · `unit` `{en,ka,ru}` (e.g. `{en:'1 day', ka:'1 დღე', ru:'1
день'}`) · `price` decimal string (2 dp) · `order` number · `is_active` boolean ·
`updated_at`. **Seed** — 7 rows, prices 80–1200, one `is_active: false`.

## landingSettings

`seed/landing.json`, a single object · backend `landing.LandingPageSettings`

`hero_title` · `hero_description` · `stats` `[{number: string, label: {en,ka,ru}}]` ·
`about_eyebrow` · `about_title` · `about_description` · `about_image` path \| null ·
`about_image_webp` path \| null · `steps_title` · `steps` `[{icon, title, description}]` ·
`benefits_title` · `benefits` `[{icon, title, description, color}]` · `cta_title` ·
`cta_description` · `cta_button_text` · `section_order` `[{key, enabled}]` · `updated_at`.
Every bare field is `{en,ka,ru}`.

`section_order` keys, in the app's default order: `hero`, `vehicle_types`, `services`,
`about`, `steps`, `benefits`, `cta`. Seed all seven in a **non-default** order with one
disabled, so the reorder feature is visibly doing something. `about_description` renders
with `white-space: pre-line`, so newlines are meaningful. `benefits[].color` must be
6-digit hex — the UI appends `'1a'` for the tint. Icons are `categoryIcons.js` keys.

## siteSettings

`seed/site-settings.json`, a single object · backend `site_settings.SiteSettings`

`site_name` `'Tonnaro'` · `site_title` · `site_logo` path \| null · `site_logo_dark` path \|
null · `favicon` path \| null · `header_display` `'both' | 'logo_only' | 'name_only'` ·
`color_theme` **`'orange'`** · `contact_phone` `'+995 322 55 07 40'` · `whatsapp_number`
`'995322550740'` (digits only, for `wa.me`) · `contact_email` `'hello@tonnaro.ge'` ·
`default_search_scope` `'georgia'` · `default_search_countries` `[]` · `footer_text`
`{en,ka,ru}` · `updated_at`.

Ship **both** logo variants — the header swaps on `ThemeContext.isDark`. `color_theme` is
just a key into `utils/colorThemes.js`; the palette lives there. `default_search_scope`
`'georgia'` is also what derives the `₾` / GEL currency in `BrandingContext`.

`terms_text` deliberately lives in its own table — it is excluded from
`SiteSettingsSerializer` upstream so it doesn't bloat the boot payload.

## seoSettings

`seed/seo.json`, a single object · backend `seo.SeoSettings`

`seo_title` / `seo_description` / `seo_keywords` `{en,ka,ru}` · `seo_og_image` path \| null
· `seo_og_image_alt` string · `seo_canonical_url` `'https://tonnaro.ge/'` · `seo_robots`
`'index,follow'` · `seo_theme_color` (6-digit hex, matching the orange accent) ·
`legal_name` · `address_street` · `address_locality` · `address_region` ·
`address_postal_code` · `address_country` `'GE'` · `geo_latitude` / `geo_longitude`
**decimal strings** (`'41.693411'`) · `opening_hours` `[{dayOfWeek: string[], opens:
'HH:MM', closes: 'HH:MM'}]` · `same_as` string[] · `schema_type` `'MovingCompany'` ·
`updated_at`.

Fill it completely — the admin form is otherwise a wall of empty inputs. Only
`seo_title`, `seo_description`, `seo_og_image_url`, `seo_og_image_alt`,
`seo_canonical_url`, `seo_robots` and `seo_theme_color` are actually consumed at runtime;
the rest round-trips through the admin form only.

## terms

`seed/terms.json`, a single object · `{en, ka, ru}` of HTML. Physically
`SiteSettings.terms_text` upstream, served only by `/site-settings/terms/`. Always exactly
these three keys, `''` for a missing language, capped at 100 000 chars each.

Seed 8–12 `<p>` blocks per language — the registration `TermsGate` scroll-gate has a 220px
box and enables its checkbox immediately if the content fits, which makes the whole feature
invisible.

---

## Tables that do not exist

- **`orderNotificationReads`** — there is no such table. Read state is the two booleans
  `is_read_by_admin` / `is_read_by_customer` on the order row, and `mark-read` is a bulk
  update over them. The notification payloads (`unread_count`, `view_counts`,
  `latest_event_at`, `recent_unread`) are all derived at request time.
- **Analytics / dashboard** — `/auth/admin/dashboard/` and `/auth/admin/analytics/` are
  aggregates over `orders`, `users`, `vehicles` and `drivers`. Nothing is stored.
- **Car-owner metrics** — `vehicles_count`, `orders_total`, `orders_active`,
  `orders_completed`, `revenue_completed`, `last_activity` are subquery annotations walked
  through `vehicles.owner_id → orders.assigned_vehicle_id`. Never seed them.

## Cross-table invariants

The seed is wrong, not merely imperfect, if any of these fail:

1. Every `services[].car_category_ids` entry exists in `categories`, and every active
   category is reachable from at least one service (step 2 of the wizard filters services
   by the chosen category and would otherwise render empty).
2. Every `vehicles[].category_ids` is non-empty and resolves; every `owner_id` resolves.
3. Every `drivers[].vehicle_ids` resolves **and** the driver's `license_categories` is a
   superset of each linked vehicle's.
4. At most one `vehicleImages` row per vehicle has `is_primary: true`, and no vehicle has
   more than 5.
5. Every order's `selected_service_id` **and** `selected_category_id` resolve — the list
   serializer falls back from one to the other.
6. Vehicles and drivers attached to orders in `ACTIVE_STATUSES` are consistent with the
   vehicle's `status` (`available` ⇒ no active order) and with anything derived from
   `is_busy`.
7. `orderImages` count per order matches whatever `image_count` the list serializer
   reports — it is derived, so this is automatic unless a handler caches it.
8. Every `pricing_breakdown.zone` names a real zone slug (except the one deliberate
   inactive-legacy row), and every `categories[].pricing_type` has a rate row for every
   active zone.
9. `route_stops.distance` / `duration` / `ascent` equal `routeSummaryFor()` for the same
   coordinates.
10. Coordinates are real Georgian ones — Tbilisi ~41.72/44.78, Batumi ~41.64/41.64,
    Kutaisi ~42.27/42.70, Rustavi ~41.55/45.02 — so the OSM tiles under the markers show
    the right place. `demo/nominatim.js` `PLACES` is the gazetteer to draw from.
11. Every phone is `+995` followed by 9 digits.

## What `store.js` does to the seed at construction

1. **Rebases every timestamp** by whole days, so the newest order's `created_at` lands on
   today in `Asia/Tbilisi`. Whole days only, so the seed's mornings stay mornings.
2. **Squeezes today** — anything that landed later than the current moment is compressed
   back into the elapsed part of the day. Applies to *past-facing* fields only;
   `scheduled_from`, `scheduled_to` and `expires_at` are allowed to point forward.
3. **Shifts the relative date columns** by the same number of days: `requested_date`,
   `license_expiry`, `hire_date`. `date_of_birth` is left alone — a birth date is a fact
   about a person, not a position relative to today.
4. **Re-arms unused verification tokens** against the real clock (10 min / 30 min), because
   a whole-day shift would otherwise leave a ten-minute window sitting in the past.
5. **Nudges `requested_date`** so at least 3 non-terminal orders are dated today and at
   least 3 in the future, no terminal order is dated ahead of today, and no order is
   requested for a day before it was placed. It prefers the least-jarring candidate and
   spreads statuses across the buckets, so `?view=today` is not three `new` rows.

A handler should therefore never assume the seeded literal dates survived. Read them off
the store.

## Pagination, and why the fleet is small

`/orders/admin/`, `/orders/`, `/orders/active/`, `/vehicles/admin/`, `/drivers/admin/` and
`/auth/admin/users/` use DRF's `{count, next, previous, results}` envelope at
`PAGE_SIZE = 20`. `/categories/`, `/categories/admin/`, `/services/`, `/services/admin/`,
`/car-owners/admin/`, `/auth/profile/contracts/` and every `/pricing/*` list return **bare
arrays**.

Nothing in the admin UI ever requests page 2 of vehicles or drivers, and the assignment
dropdowns are built entirely client-side from those payloads. So the seed keeps both at 18
rows: honest pagination and a complete dropdown at the same time. Orders is the one list
deliberately over the limit (29), because its table has a real pager.
