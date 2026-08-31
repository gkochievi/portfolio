/**
 * Side-effect entry point: importing this once registers every demo route.
 *
 * The handler modules call `register()` at module scope, so they must be
 * imported exactly once and nothing may import them lazily — `demo/index.ts`
 * pulls this in before the first render, and each seam's `lib/api.ts` pulls it
 * in before its first `dispatch()`.
 *
 * Import order is irrelevant: the router resolves by pattern and by literal
 * count, not by registration sequence. The split is by surface rather than by
 * Django app, because that is how the work divides:
 *
 * | Module            | Owns                                                        |
 * |-------------------|-------------------------------------------------------------|
 * | `auth`            | `/auth/*` — register, login, refresh, logout, me, passwords  |
 * | `public`          | `/services/` and `/landing/` — the site's read API           |
 * | `barbers`         | `/barbers/*` and the two availability reads                  |
 * | `bookings`        | `/bookings/*` — the customer's own booking surface           |
 * | `admin-bookings`  | `/admin/bookings/`, `/admin/customers/`, `/admin/users/`,    |
 * |                   | and the XLSX exports — the people-and-appointments surface   |
 * | `admin-catalog`   | `/admin/services/`, `/admin/barbers/`, hours, time off       |
 * | `admin-ops`       | audit, reviews, promotions, analytics, settings,             |
 * |                   | CMS, notification templates                                  |
 *
 * **`routes.md` is the route table** — method, pattern, owning module, auth and
 * envelope kind for all 93 routes, derived from the call sites
 * in both ported trees and reconciled against the Django URLconf. A path that is
 * not in it has no caller and must not be registered; a call site that is not in
 * it is a row somebody owes. The table is the authority on ownership: a second
 * `register()` on the same (method, pattern) silently replaces the first.
 */
import './auth';
import './public';
import './barbers';
import './bookings';
import './admin-bookings';
import './admin-catalog';
import './admin-ops';
