/**
 * Side-effect entry point: importing this once registers every demo route.
 *
 * The handler modules export nothing and call `register()` at module scope, so
 * they must be imported exactly once and nothing may import them lazily —
 * `demo/index.ts` pulls this in before the first render, and `lib/api.ts` pulls
 * it in as well so the seam cannot dispatch into an empty registry no matter
 * which module the bundler evaluates first.
 *
 * Import order is irrelevant: `resolve()` picks a route by pattern and by literal
 * count, never by registration sequence. The split follows Django's own app
 * boundaries, with the admin routers separated from the public ones because that
 * is how the work divides and how the auth level divides with it:
 *
 * | Module             | Owns                                                          | Auth   |
 * |--------------------|---------------------------------------------------------------|--------|
 * | `auth`             | the nine `/auth/*` routes                                     | mixed  |
 * | `public`           | products, collections, zodiac, site settings, page SEO, quiz  | public |
 * | `orders`           | `POST`/`GET /orders`, `GET /orders/{id}`                      | any    |
 * | `discounts`        | `POST /discounts/validate`                                    | any    |
 * | `admin-catalog`    | admin products, the image upload, collections, zodiac         | staff  |
 * | `admin-orders`     | the eight admin order routes                                  | staff  |
 * | `admin-users`      | the four admin user routes                                    | admin  |
 * | `admin-discounts`  | the six admin discount routes                                 | admin  |
 * | `admin-ops`        | dashboard, site settings, page SEO, quiz config, audit        | staff  |
 *
 * The `staff` / `admin` column is not tidy-looking by accident — it is §E.9's
 * disagreement, reproduced: the front end gates Discounts and the order-creation
 * customer picker at `staff`, and the API refuses both unless you are an `admin`.
 *
 * **`../routes.md` is the route table** — method, pattern, owning module, auth
 * level and envelope kind for every route, reconciled against the Ninja URLconf
 * and the call sites in `src/lib`. A path that is not in it has no caller and must
 * not be registered; a call site that is not in it is a row somebody owes. It is
 * also the authority on ownership, because a second `register()` on the same
 * (method, pattern) silently replaces the first.
 */
import './auth';
import './public';
import './orders';
import './discounts';
import './admin-catalog';
import './admin-orders';
import './admin-users';
import './admin-discounts';
import './admin-ops';
