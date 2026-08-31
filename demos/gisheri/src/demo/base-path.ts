/**
 * Where the bundle thinks it lives.
 *
 * Upstream this SPA is served from a domain root by Vite's dev server or nginx,
 * so it could write `/api/products` and `/media/…` as absolute paths and be
 * right. Here the same bundle sits under `/demos/gisheri/` inside the portfolio,
 * and it may instead be running on the hash router if the host cannot serve
 * `index.html` for an unknown path — so anything that is not a React Router
 * `<Link>` has to be resolved against the build's base rather than assumed.
 *
 * Everything is derived from `import.meta.env.BASE_URL`, which Vite bakes in from
 * `VITE_BASE` at build time. There is no server to ask, and no runtime
 * configuration to read.
 *
 * This module deliberately imports nothing. `App.tsx` and `DemoBanner.tsx` reach
 * into `src/demo/` for exactly these constants, and neither should have to drag
 * the error registry or the store in behind them.
 */

/** Always carries a trailing slash; Vite guarantees it. `'/demos/gisheri/'`. */
export const BASE: string = import.meta.env.BASE_URL;

/** `'browser'` unless `VITE_ROUTER=hash` was set at build time. */
export const ROUTER_MODE = __DEMO_ROUTER__;

export const HASH_ROUTING = ROUTER_MODE === 'hash';

/**
 * The router's basename — **no** trailing slash, so `` `${APP_BASE}/shop` `` is
 * sane, and carrying the `#` under hash routing so the one string works as an
 * `href` for either router.
 *
 * At a domain root this is the empty string, which `<BrowserRouter>` rejects;
 * `App.tsx` passes `APP_BASE || '/'` for that reason.
 */
export const APP_BASE = HASH_ROUTING ? `${BASE}#` : BASE.replace(/\/$/, '');

/**
 * Where `public/media/` lands once built. The seed stores bare keys
 * (`products/jade-prosperity.jpg`) so it survives a change of base path, and
 * `serialize.ts::mediaUrl()` mints the URL from here at read time.
 */
export const MEDIA_BASE = `${BASE}media/`;

/**
 * The prefix the app puts in front of every request path, and therefore the one
 * `dispatch()` has to strip back off. `lib/api.ts` builds the same string from
 * the same source, which is what keeps the two ends agreeing.
 */
export const API_PREFIX = `${BASE}api`;

/**
 * Both prefixes a request can plausibly arrive with, longest first.
 *
 * A request reaches the mock as `/demos/gisheri/api/products` under the portfolio
 * and as `/api/products` when `VITE_BASE=/`, and **both** must strip to
 * `/products`. Testing for the bare `/api` alone would 404 every request under
 * the real base — a failure that hides completely behind a root-served dev build,
 * which is exactly where it would be tested. Longest-first ordering matters at a
 * domain root, where the two collapse to the same string and the `Set` keeps one.
 */
export const API_PREFIXES: readonly string[] = [...new Set([API_PREFIX, '/api'])].sort(
  (a, b) => b.length - a.length,
);

/**
 * The portfolio that hosts this demo, resolved against the build's base rather
 * than the current route so it points at the same place from `/admin/orders` and
 * from `/product/4012` alike. A demo served at a domain root has no portfolio
 * above it and lands back on itself, which is the honest answer for that
 * deployment.
 */
export const PORTFOLIO_URL = new URL('../../', new URL(BASE, window.location.href)).href;
