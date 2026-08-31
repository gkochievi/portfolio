/**
 * Where the bundle thinks it lives.
 *
 * Upstream this app is served from a domain root by nginx, so it could write
 * `/login` and `/admin` as absolute paths and be right. Here the same bundle
 * sits under `/demos/tonnaro/` inside the portfolio, and it may instead be
 * running on the hash router if the host cannot do SPA fallback — so the two
 * navigations the app performs outside React Router have to be resolved
 * against the build's base rather than assumed.
 *
 * Everything is derived from `import.meta.env.BASE_URL`, which Vite bakes in
 * from `VITE_BASE` at build time. There is no server to ask.
 */

/** Always has a trailing slash; Vite guarantees it. */
export const BASE_URL = import.meta.env.BASE_URL

export const HASH_ROUTING = __DEMO_ROUTER__ === 'hash'

/** No trailing slash, so `${APP_BASE}/login` is sane. Carries the '#' under
 *  hash routing, so the one string works as an href for both routers. */
export const APP_BASE = HASH_ROUTING ? `${BASE_URL}#` : BASE_URL.replace(/\/$/, '')

/** The route the visitor is on, as React Router sees it. */
export function appLocation() {
  if (HASH_ROUTING) return window.location.hash.slice(1) || '/'
  const path = window.location.pathname
  const stripped = path.startsWith(APP_BASE) ? path.slice(APP_BASE.length) : path
  return (stripped || '/') + window.location.search
}

/** A full-page navigation to an app route, whichever router is in play. */
export function navigateHard(route) {
  window.location.href = `${APP_BASE}${route}`
}

/**
 * The portfolio that hosts this demo, resolved against the build's base rather
 * than the current route so it points at the same place from `/admin/orders`
 * and `/app/order/new` alike. A demo served at a domain root has no portfolio
 * above it and lands back on itself, which is the honest answer for that
 * deployment.
 */
export const PORTFOLIO_URL = new URL('../../', new URL(BASE_URL, window.location.href)).href

/**
 * Media bundled with the demo. The seed stores bare paths so it survives a
 * change of base path; URLs are built here and in `demo/serialize.js`.
 */
export function mediaUrl(path) {
  if (!path) return null
  if (/^(https?:|blob:|data:)/.test(path)) return path
  return `${BASE_URL}media/${String(path).replace(/^\/+/, '')}`
}
