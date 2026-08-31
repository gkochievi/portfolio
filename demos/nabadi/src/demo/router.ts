/**
 * Request dispatch for the in-browser API. Both `lib/api.ts` seams call
 * `dispatch()`; the seven handler modules fill the registry below.
 *
 * ## Handler contract
 *
 * ```ts
 * import { notFound } from '../base';
 * import { register } from '../router';
 * import { serializeBarber } from '../serialize';
 * import { barberById } from '../store';
 *
 * register('GET', '/barbers/:id/', (request) => {
 *   const barber = barberById(Number(request.path.id));
 *   if (!barber?.is_active) throw notFound();
 *   return serializeBarber(barber);
 * }, { auth: 'public' });
 *
 * register('POST', '/admin/bookings/', createWalkIn, {   // createWalkIn: local to the module
 *   auth: ['admin'],
 * })
 * ```
 *
 * - Patterns are matched *after* the `/api` prefix and keep DRF's trailing
 *   slash, because that is the path both front ends ask for. `/services/` and
 *   `/services` are different URLs and only the first is registered.
 * - `:name` captures exactly one segment; captures arrive as strings on
 *   `req.path` (`req.path.id`). A literal segment always beats a capture, so
 *   `/admin/bookings/export-xlsx/` and `/admin/bookings/:id/` can coexist.
 * - `req.params` is the query string, normalised to strings the way `fetch`
 *   would have serialised it: blank, null and undefined values are dropped.
 *   `req.paramsAll` keeps the repeats, for the handful of filters that accept
 *   a key more than once.
 * - `req.body` is whatever the seam was handed — a parsed JSON value, or the
 *   `FormData` the two multipart endpoints post. Handlers narrow it themselves.
 * - `req.user` is the signed-in row, already resolved and already checked for
 *   `is_active`. It is `null` only on a route registered `auth: 'public'`.
 * - Return the payload. `undefined` becomes `null`, which is how a 204 reads on
 *   the wire — both seams short-circuit on it and return `undefined`.
 * - Return `file(blob, name)` from `base.ts` for an XLSX export; the seam
 *   unwraps it into a real download.
 * - Fail by throwing `DemoApiError` — `fail('slot_taken', 'start_at')` and the
 *   helpers beside it. Anything else that escapes a handler becomes a 500
 *   `server_error`, which is exactly what the real exception handler does with
 *   an exception DRF does not recognise.
 * - Do not sleep, do not catch your own errors, do not reshape them. Latency,
 *   the auth gate and error shaping live here so the handler modules stay
 *   declarative.
 *
 * Handlers register on import, so they must be pulled in exactly once:
 * `import './handlers'`, which `demo/index.ts` does.
 */

import {
  DemoApiError,
  isFileResponse,
  nextLatency,
  notAuthenticated,
  notFound,
  permissionDenied,
  sleep,
} from './base';
import { autoCompleteStaleBookings, currentUser } from './store';
import type { Role, UserRow } from './types';
import { ROLES } from './types';

export type HttpMethod = 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
export type DemoParams = Record<string, string>;

export interface DemoRequest {
  method: HttpMethod;
  /** The matched path, prefix stripped, no query string: `/admin/bookings/`. */
  url: string;
  /** Captured `:name` segments, e.g. `{id: '11003'}`. */
  path: Record<string, string>;
  params: DemoParams;
  /** Repeated keys, for a filter that accepts a list. Single keys appear here too. */
  paramsAll: Record<string, string[]>;
  body: unknown;
  /** Null only on `auth: 'public'` routes. */
  user: UserRow | null;
}

export type DemoHandler = (request: DemoRequest) => unknown;

export interface RouteOptions {
  /**
   * `'public'` — no session (DRF `AllowAny`).
   * `'any'` — signed in, role irrelevant (`IsAuthenticated`). The default.
   * An array — signed in **and** role in the list. In practice that array is
   * always `['admin']`: `admin` is the only role the staff console admits.
   */
  auth?: 'public' | 'any' | Role[];
}

interface Route {
  method: HttpMethod;
  pattern: string;
  segments: string[];
  /** Literal segments beat captures when two patterns match the same path. */
  literals: number;
  auth: 'public' | 'any' | Role[];
  handler: DemoHandler;
}

/**
 * Where the API lives, from the mock's point of view.
 *
 * Upstream both SPAs pointed at `VITE_API_URL || 'http://localhost:8000/api'`;
 * here the seam derives its base from the deploy base instead
 * (`API_BASE = ${import.meta.env.BASE_URL}api`, DECISIONS.md addendum), so a
 * request arrives as `/demos/nabadi/api/services/` under the portfolio's
 * default base and as `/api/services/` when the demo is served at a domain root.
 *
 * Both have to strip to `/services/`. Testing for a bare `/api` would match
 * neither under the default base, no route would resolve, and **every** request
 * would 404 with `[demo] no route for …` — a failure that hides completely
 * behind `VITE_BASE=/`.
 *
 * `BASE_URL` always ends in a slash, so the deployed prefix is `${BASE_URL}api`.
 * The bare `/api` stays as a fallback for a path the seam passed unprefixed and
 * for the hash-router mode, where the document's own path carries the base and
 * the seam's path does not.
 *
 * `/api/admin/…` is not a second prefix — it is `apps.admin_api` mounted under
 * the same root.
 */
const API_PREFIX = `${import.meta.env.BASE_URL}api`;

/** The prefixes `dispatch` will strip, longest first so `/api` never wins early. */
const API_PREFIXES: readonly string[] = [...new Set([API_PREFIX, '/api'])].sort(
  (left, right) => right.length - left.length,
);

function stripApiPrefix(path: string): string {
  for (const prefix of API_PREFIXES) {
    if (path === prefix) return '/';
    if (path.startsWith(`${prefix}/`)) return path.slice(prefix.length);
  }
  return path;
}

const routes: Route[] = [];

export function register(
  method: HttpMethod,
  pattern: string,
  handler: DemoHandler,
  options: RouteOptions = {},
): void {
  const auth = options.auth ?? 'any';
  // Validated at registration rather than at request time: a typo in a role
  // would otherwise surface as a 403 on a screen nobody opens until the demo
  // is live.
  if (Array.isArray(auth)) {
    for (const role of auth) {
      if (!ROLES.includes(role)) throw new Error(`Unknown role "${role}" on ${method} ${pattern}`);
    }
  } else if (auth !== 'public' && auth !== 'any') {
    throw new Error(`Unknown auth level "${String(auth)}" on ${method} ${pattern}`);
  }
  if (!pattern.startsWith('/') || !pattern.endsWith('/')) {
    throw new Error(`Pattern "${pattern}" must open and close with a slash (DRF's trailing slash).`);
  }

  const segments = pattern.split('/');
  const route: Route = {
    method,
    pattern,
    segments,
    literals: segments.filter((segment) => !segment.startsWith(':')).length,
    auth,
    handler,
  };

  // Replacing rather than appending keeps a hot module reload from stacking two
  // handlers on one route.
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
    const pattern = route.segments[index];
    if (pattern.startsWith(':')) {
      if (!segments[index]) return null;
      captured[pattern.slice(1)] = decodeURIComponent(segments[index]);
      continue;
    }
    if (pattern !== segments[index]) return null;
  }
  return captured;
}

function resolve(method: HttpMethod, path: string, segments: string[]): Match {
  if (routes.length === 0) {
    throw new DemoApiError(500, 'server_error');
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
  // DRF answers a matched path with an unmatched verb itself, so the write
  // routes Django refuses are simply not registered. `MethodNotAllowed` is an
  // `APIException` the classifier does not recognise, so it keeps its 405 and
  // degrades to the generic validation code.
  if (otherMethod) throw new DemoApiError(405, 'validation_error');
  // Upstream this is Django's HTML 404, which the client reads as
  // `code: 'unknown'`. Here an unmatched route means a handler module forgot to
  // register one, so it says so out loud and answers with the JSON envelope.
  console.warn(`[demo] no route for ${method} ${path}`);
  throw notFound();
}

/**
 * `fetch` drops null, undefined and blank values and stringifies the rest;
 * reproducing that here means a handler reads exactly what Django's
 * `request.GET` held.
 */
function normaliseParams(
  raw: Record<string, unknown> | undefined,
  single: DemoParams,
  multi: Record<string, string[]>,
): void {
  for (const [key, value] of Object.entries(raw ?? {})) {
    if (value === null || value === undefined || value === '') continue;
    const values = Array.isArray(value) ? value : [value];
    // A key this call supplies replaces the key entirely rather than appending
    // to it, so `params` and `paramsAll` cannot disagree about which values are
    // in play: an explicit `{status: 'confirmed'}` override of a path that
    // already said `?status=pending` yields exactly `['confirmed']` in both.
    let seen = false;
    for (const item of values) {
      if (item === null || item === undefined || item === '') continue;
      const text = String(item);
      single[key] = text;
      if (!seen) {
        multi[key] = [];
        seen = true;
      }
      multi[key].push(text);
    }
  }
}

export interface DispatchOptions {
  params?: Record<string, unknown>;
  body?: unknown;
}

const READ_METHODS = new Set<HttpMethod>(['GET']);

/**
 * The gate, in DRF's own order: authenticate, then the role check. Getting the
 * order wrong is visible — an anonymous request to an admin route must be a 401
 * so the console's silent refresh fires, not a 403 that would bounce a visitor
 * straight to the login page with no explanation.
 */
function gate(route: Route): UserRow | null {
  if (route.auth === 'public') return currentUser();

  const user = currentUser();
  if (!user) throw notAuthenticated();

  if (Array.isArray(route.auth) && !route.auth.includes(user.role)) throw permissionDenied();

  return user;
}

export async function dispatch<T = unknown>(
  method: string,
  path: string,
  options: DispatchOptions = {},
): Promise<T> {
  const verb = method.toUpperCase() as HttpMethod;

  // The seam hands over whatever it built out of `VITE_API_URL`, which may be
  // an absolute URL. Strip the origin, then the `/api` prefix, and match on
  // what DRF's URLconf would have seen.
  const withoutOrigin = /^[a-z]+:\/\//i.test(path)
    ? path.replace(/^[a-z]+:\/\/[^/]*/i, '')
    : path;
  const [rawPath = '', queryString = ''] = withoutOrigin.split('?');
  const withoutPrefix = stripApiPrefix(rawPath);
  const url = withoutPrefix.startsWith('/') ? withoutPrefix : `/${withoutPrefix}`;
  const segments = url.split('/');

  const params: DemoParams = {};
  const paramsAll: Record<string, string[]> = {};
  // A path may already carry a query string — every list call site builds one —
  // and explicit params win over it. The repeats are gathered by hand rather
  // than through `Object.fromEntries`, which keeps only the last value per key
  // and would make `paramsAll` a copy of `params`: `paginate()` then republishes
  // a `next` URL with a repeated filter silently collapsed.
  const fromQuery: Record<string, string[]> = {};
  for (const [key, value] of new URLSearchParams(queryString)) (fromQuery[key] ??= []).push(value);
  normaliseParams(fromQuery, params, paramsAll);
  normaliseParams(options.params, params, paramsAll);

  await sleep(nextLatency(READ_METHODS.has(verb)));

  // The sweep Celery ran hourly. Cheap over forty rows, and running it on every
  // request is what keeps a booking the visitor made from being frozen in
  // `pending` for the life of the tab.
  autoCompleteStaleBookings();

  const { route, path: captured } = resolve(verb, url, segments);
  const user = gate(route);

  let result: unknown;
  try {
    result = await route.handler({
      method: verb,
      url,
      path: captured,
      params,
      paramsAll,
      body: options.body,
      user,
    });
  } catch (error) {
    if (error instanceof DemoApiError) throw error;
    // Whatever DRF's handler did not recognise became a 500 with a logged
    // traceback; `console.error` is this demo's Sentry.
    console.error('[demo] handler failed', error);
    throw new DemoApiError(500, 'server_error');
  }

  // `undefined` is how a handler says 204; both seams read that back as
  // `undefined` after seeing the null.
  return (result ?? null) as T;
}

export { isFileResponse };

/** Every registered route, for the boot log and for a "what exists" check. */
export function registeredRoutes(): string[] {
  return routes.map((route) => `${route.method} ${API_PREFIX}${route.pattern}`).sort();
}

/**
 * The deploy-aware API prefix, exported so `query.ts` can build `next`/`previous`
 * URLs that agree with what the seam actually calls.
 */
export { API_PREFIX };
