/**
 * Request dispatch for the in-browser API. `lib/api.ts` and the one hunk of
 * `lib/admin-api.ts` call `dispatch()`; the nine handler modules fill the
 * registry below.
 *
 * ## Handler contract
 *
 * ```ts
 * import { notFound } from '../base';
 * import { register } from '../router';
 * import { serializeProduct } from '../serialize';
 * import { productById } from '../store';
 *
 * register('GET', '/products/:id', (request) => {
 *   const product = productById(Number(request.path.id));
 *   if (!product) throw notFound();
 *   return serializeProduct(product);
 * }, { auth: 'public' });
 *
 * register('POST', '/admin/products/bulk', bulkProducts, {   // bulkProducts: module-local
 *   auth: ['staff', 'admin'],
 * });
 * ```
 *
 * - Patterns are matched *after* the API prefix and carry **no trailing
 *   slash**. This is Django-Ninja, not DRF: the URLconf mounts `/api/products`,
 *   and `/api/products/` is a different URL that answers 404. `register()`
 *   refuses a pattern ending in a slash at boot, so a pattern typed the DRF way
 *   fails loudly on the first page load rather than 404-ing under a spinner.
 * - `:name` captures exactly one segment and arrives on `req.path` as a string
 *   (`req.path.id`). A capture named `id`, or ending in `Id` / `_id`, is
 *   Django's `<int:…>` converter and matches **digits only** — see
 *   `isNumericCapture`. Every other capture is `<str:…>`, which is what lets
 *   `/admin/zodiac/:sign` take `scorpio`.
 * - A literal segment always beats a capture, so `/admin/products/bulk` and
 *   `/admin/products/:id` coexist whatever order they were registered in.
 * - `req.params` is the query string, keys as the app sent them — **snake_case**
 *   (`page_size`, `date_from`, `is_bestseller`), because those are Ninja
 *   *function* parameters and the camelising alias generator only ever touched
 *   request and response *bodies*. Values are raw strings; `query.ts` has the
 *   coercions.
 * - `req.body` is whatever the seam was handed: a parsed JSON value, or the
 *   `FormData` the image upload posts. Handlers narrow it themselves, usually
 *   through `bodyOf()` and the readers next to it.
 * - `req.user` is the signed-in row, already resolved from the bearer token and
 *   already checked for `is_active`. It is `null` only on an `auth: 'public'`
 *   route — and even there it may be a real row, because a public handler is
 *   still told who is asking.
 * - Return the payload. `undefined` becomes `null`, which is how a 204 reads on
 *   the wire and what `api.delete<void>()` expects back.
 * - Fail by throwing from `base.ts`: `fail('discount_invalid')`, `notFound()`,
 *   `validationError(['body', 'code'], …)`. Anything else that escapes becomes a
 *   500 `Internal Server Error`, which is what Ninja does with an exception it
 *   does not recognise.
 * - **Do not sleep, do not catch your own errors, do not reshape them.** Latency,
 *   the auth gate and error shaping live in `dispatch()` so the handler modules
 *   stay declarative.
 *
 * Object-level scoping — "this customer's own order" — is deliberately *not*
 * expressible here. Upstream it is `get_object_or_404(Order, pk=…, user=request.auth)`
 * inside the view, and it answers **404, not 403**: the gate says whether you may
 * call the endpoint, the handler says whether the row exists for you. A route
 * option that promoted that to a 403 would leak which order ids are taken.
 *
 * Handlers register on import, so the modules must be pulled in exactly once:
 * `import './handlers'`, which both `demo/index.ts` and the seam do.
 */

import {
  DemoApiError,
  adminRequired,
  methodNotAllowed,
  nextLatency,
  notFound,
  serverError,
  sleep,
  staffRequired,
  unauthorized,
} from './base';
import { API_PREFIX, API_PREFIXES } from './base-path';
import { userForAccessToken } from './auth-tokens';
import type { Role, UserRow } from './types';
import { ROLES } from './types';

/** The four verbs the app uses. There is no `PUT` anywhere in `src/lib/*-api.ts`. */
export type HttpMethod = 'GET' | 'POST' | 'PATCH' | 'DELETE';

/** Structurally identical to `query.ts`'s own `DemoParams`, which is declared there to avoid this import. */
export type DemoParams = Record<string, string>;

export interface DemoRequest {
  method: HttpMethod;
  /** The matched path, prefix stripped, query string removed: `/admin/orders/6012/items/8033`. */
  url: string;
  /** Captured `:name` segments, e.g. `{orderId: '6012', itemId: '8033'}`. Always strings. */
  path: Record<string, string>;
  params: DemoParams;
  /** A parsed JSON value, or the `FormData` the image upload posts. */
  body: unknown;
  /** Resolved from the bearer token and already `is_active`-checked. */
  user: UserRow | null;
}

export type DemoHandler = (request: DemoRequest) => unknown;

export interface RouteOptions {
  /**
   * `'public'` — no `auth=` on the Ninja router at all.
   * `'any'` — `jwt_auth`: signed in, role irrelevant. The default.
   * `['staff', 'admin']` — `staff_auth`. `['admin']` — `admin_auth`.
   *
   * The array is not cosmetic: the two role gates carry different sentences
   * upstream, and `roleFailure()` picks between them by looking at it.
   */
  auth?: 'public' | 'any' | Role[];
}

// --------------------------------------------------------------------------- //
//  Patterns
// --------------------------------------------------------------------------- //

interface Segment {
  /** The literal text, or the capture's name when `capture` is true. */
  value: string;
  capture: boolean;
  /** Django's `<int:…>` converter: this segment matches `/^\d+$/` and nothing else. */
  numeric: boolean;
}

/**
 * Which captures are integers, decided by name.
 *
 * Every path parameter in this API is typed in the URLconf — `{product_id: int}`,
 * `{order_id: int}`, `{item_id: int}`, `{page_id: int}`, and `{sign: str}` for the
 * zodiac. An `int` converter **cannot match a non-numeric segment**, and that is
 * load-bearing rather than pedantic: `/api/admin/products/bulk` and
 * `/api/admin/products/{product_id}` are two routes on the same Ninja router, and
 * it is the converter — not the registration order — that keeps `bulk` out of the
 * detail view. The same goes for `/admin/users/bulk`, `/admin/discounts/bulk` and
 * `/admin/orders/bulk-status`.
 *
 * Deciding by name — `id`, or anything ending in `Id` or `_id`, the two spellings
 * a handler author might reach for — rather than by a converter spelling in the
 * pattern keeps the patterns readable, and means writing `:id` gets the right
 * behaviour without having to know this rule exists. The literal-beats-capture
 * tie-break in `resolve()` would already protect the four `bulk` routes on its
 * own; this is the half that also makes `/admin/products/nonsense` a routing 404
 * rather than a handler that has to think about `Number('nonsense')`.
 */
function isNumericCapture(name: string): boolean {
  return name === 'id' || name.endsWith('Id') || name.endsWith('_id');
}

interface Route {
  method: HttpMethod;
  pattern: string;
  segments: Segment[];
  /** Literal segments beat captures when two patterns match the same path. */
  literals: number;
  auth: 'public' | 'any' | Role[];
  handler: DemoHandler;
}

function parsePattern(pattern: string, method: HttpMethod): Segment[] {
  if (!pattern.startsWith('/')) {
    throw new Error(`Pattern "${pattern}" must start with a slash (${method}).`);
  }
  // Inverted from the DRF demos next door, and deliberately: Ninja mounts these
  // paths without a trailing slash, so `/products/` is not `/products` and would
  // 404 for every caller. Catching it here turns a silent dead route into a
  // boot-time throw.
  if (pattern.endsWith('/')) {
    throw new Error(`Pattern "${pattern}" must not end with a slash — Ninja mounts these paths bare.`);
  }

  return pattern.split('/').map((raw, index) => {
    if (index > 0 && raw === '') {
      throw new Error(`Pattern "${pattern}" has an empty segment.`);
    }
    if (!raw.startsWith(':')) return { value: raw, capture: false, numeric: false };
    const name = raw.slice(1);
    if (!name) throw new Error(`Pattern "${pattern}" has an unnamed capture.`);
    return { value: name, capture: true, numeric: isNumericCapture(name) };
  });
}

const routes: Route[] = [];

export function register(
  method: HttpMethod,
  pattern: string,
  handler: DemoHandler,
  options: RouteOptions = {},
): void {
  const auth = options.auth ?? 'any';
  // Validated at registration rather than at request time: a mistyped role would
  // otherwise surface as a 403 on a screen nobody opens until the demo is live.
  if (Array.isArray(auth)) {
    if (auth.length === 0) throw new Error(`Empty role list on ${method} ${pattern}`);
    for (const role of auth) {
      if (!ROLES.includes(role)) throw new Error(`Unknown role "${role}" on ${method} ${pattern}`);
    }
  } else if (auth !== 'public' && auth !== 'any') {
    throw new Error(`Unknown auth level "${String(auth)}" on ${method} ${pattern}`);
  }

  const segments = parsePattern(pattern, method);
  const route: Route = {
    method,
    pattern,
    segments,
    literals: segments.filter((segment) => !segment.capture).length,
    auth,
    handler,
  };

  // Replacing rather than appending keeps a hot module reload from stacking two
  // handlers on one route — and makes a duplicate registration a silent
  // last-one-wins, which is why `routes.md` is the authority on ownership.
  const existing = routes.findIndex((entry) => entry.method === method && entry.pattern === pattern);
  if (existing >= 0) routes[existing] = route;
  else routes.push(route);
}

interface Match {
  route: Route;
  path: Record<string, string>;
}

function capture(route: Route, segments: string[]): Record<string, string> | null {
  if (route.segments.length !== segments.length) return null;

  const captured: Record<string, string> = {};
  for (let index = 0; index < segments.length; index += 1) {
    const expected = route.segments[index];
    const actual = segments[index];
    if (!expected.capture) {
      if (expected.value !== actual) return null;
      continue;
    }
    if (!actual) return null;
    // `<int:…>`. Django tests the raw segment, before any decoding, so `%34` is
    // not a 4 — and neither is it here.
    if (expected.numeric && !/^\d+$/.test(actual)) return null;
    try {
      captured[expected.value] = decodeURIComponent(actual);
    } catch {
      // A malformed escape (`/admin/zodiac/%zz`, which a hand-typed URL can
      // reach) matches no converter, so it is a 404 like any other unresolvable
      // path. Letting the `URIError` out would be worse than useless: it escapes
      // `dispatch` before the handler's own try/catch and arrives at the app as
      // a raw throw rather than as a reply.
      return null;
    }
  }
  return captured;
}

function resolve(method: HttpMethod, path: string, segments: string[]): Match {
  // An empty registry means `handlers/index.ts` was never imported, which would
  // otherwise present as every single request 404-ing at once with no clue why.
  if (routes.length === 0) {
    console.error('[demo] no routes are registered — is `demo/handlers` imported?');
    throw serverError();
  }

  let best: Match | null = null;
  let otherMethod = false;

  for (const route of routes) {
    const captured = capture(route, segments);
    if (captured === null) continue;
    if (route.method !== method) {
      otherMethod = true;
      continue;
    }
    if (!best || route.literals > best.route.literals) best = { route, path: captured };
  }

  if (best) return best;
  // Ninja answers a matched path with an unmatched verb itself, so the verbs the
  // API does not implement are simply not registered and land here.
  if (otherMethod) throw methodNotAllowed();
  // Upstream this is Django's own 404. Here an unmatched route means a handler
  // module forgot to register one, so it says so out loud first.
  console.warn(`[demo] no route for ${method} ${path}`);
  throw notFound();
}

// --------------------------------------------------------------------------- //
//  The gate
// --------------------------------------------------------------------------- //

/**
 * `StaffJWTAuth` and `AdminJWTAuth` each raise their own sentence, and the admin
 * console shows it verbatim in a toast — a `staff` user who opens Discounts reads
 * `Admin role required.` and that is the whole point of reproducing the role
 * split (§E.9). The role list is what tells the two apart: a gate that admits
 * `staff` is the staff gate.
 */
function roleFailure(allowed: Role[]): DemoApiError {
  return allowed.includes('staff') ? staffRequired() : adminRequired();
}

/**
 * Ninja's own order: authenticate, **then** check the role.
 *
 * Getting it the wrong way round is visible rather than theoretical. `api.ts`
 * retries exactly once, and only on a **401** with a refresh token in hand, so a
 * 403 where a 401 belongs kills the silent refresh: every admin page would sign
 * the visitor out the first time their thirty-minute access token lapsed.
 *
 * A `'public'` route still resolves the caller. Upstream that happens for free —
 * the router has no `auth=`, so `request.auth` is simply absent and nothing looks
 * at it — and here it costs one lookup and lets a public handler know who is
 * asking without a second code path.
 */
function gate(route: Route, token: string | null): UserRow | null {
  const user = userForAccessToken(token);
  if (route.auth === 'public') return user;
  if (!user) throw unauthorized();
  if (Array.isArray(route.auth) && !route.auth.includes(user.role)) throw roleFailure(route.auth);
  return user;
}

// --------------------------------------------------------------------------- //
//  Dispatch
// --------------------------------------------------------------------------- //

export interface DispatchOptions {
  body?: unknown;
  /** The bearer token, or `null` for a request deliberately sent without one. */
  token?: string | null;
}

/**
 * Strip the prefix the seam put on, whichever of the two it was.
 *
 * `API_PREFIXES` is `['/demos/gisheri/api', '/api']` under the portfolio and just
 * `['/api']` at a domain root, longest first — see `base-path.ts`, which builds
 * it from the same `BASE_URL` the seam builds its own base from.
 */
function stripApiPrefix(path: string): string {
  for (const prefix of API_PREFIXES) {
    if (path === prefix) return '/';
    if (path.startsWith(`${prefix}/`)) return path.slice(prefix.length);
  }
  return path;
}

export async function dispatch<T = unknown>(
  method: string,
  path: string,
  options: DispatchOptions = {},
): Promise<T> {
  // `method` arrives as a bare `string` because the seam reads it off
  // `RequestInit['method']`. An unknown verb is not repaired: it simply matches
  // no route's method and comes back out of `resolve()` as the 405 it is.
  const verb = method.toUpperCase() as HttpMethod;

  // The seam builds `${import.meta.env.BASE_URL}api/...`, which is already
  // origin-relative — but it also passes a caller's `path.startsWith('http')`
  // straight through, so an absolute URL has to survive this.
  const withoutOrigin = /^[a-z]+:\/\//i.test(path) ? path.replace(/^[a-z]+:\/\/[^/]*/i, '') : path;
  const [rawPath = '', queryString = ''] = withoutOrigin.split('?');
  const withoutPrefix = stripApiPrefix(rawPath);
  const url = withoutPrefix.startsWith('/') ? withoutPrefix : `/${withoutPrefix}`;
  const segments = url.split('/');

  // Raw strings, exactly as Django's `request.GET` would have held them — an
  // empty `?q=` stays an empty string rather than becoming absent, because that
  // is the difference between `name__icontains=""` (matches everything) and no
  // filter at all. In practice every call site drops blanks before it builds the
  // query string; `query.ts` guards the rest.
  const params: DemoParams = {};
  for (const [key, value] of new URLSearchParams(queryString)) params[key] = value;

  // Latency first, so a failed lookup is as slow as a successful one and the
  // spinner behaves the same either way. Reads and writes have different bands.
  await sleep(nextLatency(verb === 'GET'));

  // No background sweep here. Upstream has no periodic job at all — discount
  // expiry and the one-hour reset-token TTL are both computed at read time — so
  // dispatch is latency, resolve, gate, handler and nothing else.
  const { route, path: captured } = resolve(verb, url, segments);
  const user = gate(route, options.token ?? null);

  let result: unknown;
  try {
    result = await route.handler({
      method: verb,
      url,
      path: captured,
      params,
      body: options.body,
      user,
    });
  } catch (error) {
    if (error instanceof DemoApiError) throw error;
    // Whatever Ninja's exception handler did not recognise became a 500 with a
    // logged traceback. `console.error` is this demo's Sentry.
    console.error('[demo] handler failed', error);
    throw serverError();
  }

  // `undefined` is how a handler says 204 — `DELETE /admin/products/{id}` and
  // its three siblings return nothing at all, and the seam reads the null back
  // into the `void` those wrappers are typed with.
  return (result ?? null) as T;
}

/** Every registered route, for the boot log and for a "what actually exists" check. */
export function registeredRoutes(): string[] {
  return routes.map((route) => `${route.method} ${API_PREFIX}${route.pattern}`).sort();
}
