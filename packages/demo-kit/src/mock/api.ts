/**
 * The in-browser API every demo talks to instead of a server.
 *
 * A demo's `lib/api.ts` keeps the shape it would have had against a real
 * backend and calls `api.dispatch()` where it would have called `fetch`.
 * Handler modules fill the registry:
 *
 * ```ts
 * export const api = createMockApi({ prefix: '/api', isAuthenticated: session.isSignedIn })
 * api.register('GET', '/orders/:id/', ({ path }) => serializeOrder(mustFindOrder(path.id)))
 * ```
 *
 * ## Handler contract (ported from Printomato's `demo/router.ts`)
 *
 * - Patterns are matched *after* `prefix` is stripped, and the trailing slash
 *   is significant: `/orders/` and `/orders` are different routes, exactly as
 *   they are to Django.
 * - `:name` captures exactly one non-empty segment; captures arrive decoded on
 *   `req.path` (`req.path.id`). A literal segment always beats a capture, so
 *   `/orders/export/` and `/orders/:id/` coexist in any registration order.
 * - A path that some route matches under another method is a 405, not a 404.
 * - `req.params` is the query string normalised the way `fetch` would have
 *   serialised it: blank, null and undefined values are dropped, the rest are
 *   strings. Explicit `params` win over a query string already on the path.
 * - `req.body` is what the client passed, structured-cloned so a handler may
 *   keep it without aliasing the caller's object. `FormData` passes through.
 * - Return the payload, or a promise of it. `undefined` becomes `null`, which
 *   is how a 204 reads on the wire. The payload is cloned on the way out, so a
 *   component that mutates a response can never edit the store behind it.
 * - Fail by throwing `DemoApiError`. Anything else that escapes a handler
 *   becomes a 500 carrying its message; an `AbortError` passes through.
 * - Every route needs a session unless its pattern starts with one of
 *   `publicPrefixes` (default `/auth/`); `{requiresAuth}` overrides per route.
 * - Do not sleep, catch your own errors or reshape them. Latency and error
 *   shaping live here so handler modules stay declarative.
 */

/** Field name → messages; always arrays, the shape a DRF serializer returns. */
export type FieldErrors = Record<string, string[]>

/** Handlers may write a bare string per field; DRF would have listed it. */
export type FieldErrorInput = Record<string, string | string[]>

/**
 * The only error a handler should throw. `dispatch()` rejects with it, so a
 * demo's API client can map it onto whatever error type its UI already reads.
 */
export class DemoApiError extends Error {
  /** HTTP status the request would have failed with. */
  readonly status: number
  /** Per-field messages for inline form errors; empty for non-validation failures. */
  readonly fieldErrors: FieldErrors

  /**
   * @param status       HTTP status code (400, 401, 403, 404, 409, 500, …).
   * @param message      Human-readable summary, shown when no field claims it.
   * @param fieldErrors  Optional per-field messages; strings are wrapped in arrays.
   */
  constructor(status: number, message: string, fieldErrors: FieldErrorInput = {}) {
    super(message)
    this.name = 'DemoApiError'
    this.status = status
    this.fieldErrors = Object.fromEntries(
      Object.entries(fieldErrors).map(([field, value]) => [
        field,
        Array.isArray(value) ? value.map(String) : [String(value)],
      ]),
    )
  }

  /**
   * The 400 a serializer raises: the field errors, plus the first of them as
   * the message so a toast has something to say.
   */
  static validation(fields: FieldErrorInput): DemoApiError {
    const first = Object.values(fields)[0]
    const message = Array.isArray(first) ? first[0] : first
    return new DemoApiError(400, message ?? 'Invalid input.', fields)
  }
}

/** A 404 with DRF's wording unless told otherwise. */
export function notFound(detail = 'Not found.'): DemoApiError {
  return new DemoApiError(404, detail)
}

/** A 403 — signed in, but this role may not do that. */
export function forbidden(detail = 'You do not have permission to perform this action.'): DemoApiError {
  return new DemoApiError(403, detail)
}

/** A 409 — the write is valid but collides with the current state (a double booking, a stale edit). */
export function conflict(detail = 'This conflicts with the current state of the resource.'): DemoApiError {
  return new DemoApiError(409, detail)
}

/** The verbs a handler can register under. */
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'

/** The normalised query string a handler receives. */
export type DemoParams = Record<string, string>

/** What a handler is called with. */
export interface DemoRequest {
  method: HttpMethod
  /** Captured `:name` segments, decoded, e.g. `{id: '3'}`. */
  path: Record<string, string>
  /** Query string plus explicit params, all strings, blanks dropped. */
  params: DemoParams
  /** The (cloned) request body; handlers narrow it themselves. */
  body: unknown
  /** The caller's abort signal, for handlers that do slow work of their own. */
  signal?: AbortSignal | undefined
}

/** A route handler. May be async; `undefined` reads as a 204. */
export type DemoHandler = (request: DemoRequest) => unknown | Promise<unknown>

/** Per-route options for `register()`. */
export interface RouteOptions {
  /** Defaults to true for every pattern outside `publicPrefixes`. */
  requiresAuth?: boolean | undefined
}

/** `[min, max]` milliseconds; each request sleeps a uniform random time in between. */
export type LatencyRange = readonly [min: number, max: number]

/** Configuration for `createMockApi()`. */
export interface MockApiOptions {
  /** Stripped from the front of every path before matching, e.g. `/api`. Default `''`. */
  prefix?: string | undefined
  /** Simulated network time. Default `{read: [90, 260], write: [140, 340]}`; `[0, 0]` in tests. */
  latency?: { read: LatencyRange; write: LatencyRange } | undefined
  /** Read on every request to a protected route; false means 401. */
  isAuthenticated: () => boolean
  /** Patterns starting with any of these are public by default. Default `['/auth/']`. */
  publicPrefixes?: readonly string[] | undefined
}

/** The per-request options `dispatch()` takes. */
export interface DispatchOptions {
  params?: Record<string, string | number | boolean | null | undefined> | undefined
  body?: unknown
  signal?: AbortSignal | undefined
}

/** One registered route as `routes()` lists it — what a docs script prints. */
export interface RouteInfo {
  method: HttpMethod
  pattern: string
  requiresAuth: boolean
}

/** The object `createMockApi()` returns. */
export interface MockApi {
  /**
   * Add a route. Registering the same method + pattern again replaces the
   * earlier handler, so a hot module reload never stacks two on one route.
   */
  register(method: HttpMethod, pattern: string, handler: DemoHandler, options?: RouteOptions): void
  /**
   * Run one request. Resolves with the handler's (cloned) payload, or rejects
   * with a `DemoApiError` — or an `AbortError` when `signal` fires.
   * `method` is case-insensitive; an unknown verb on a known path is a 405.
   */
  dispatch<T = unknown>(method: string, path: string, options?: DispatchOptions): Promise<T>
  /** Every registered route, in registration order. */
  routes(): RouteInfo[]
}

interface Route extends RouteInfo {
  segments: string[]
  /** Literal segments beat captures when two patterns match the same path. */
  literals: number
  handler: DemoHandler
}

interface Match {
  route: Route
  path: Record<string, string>
}

const DEFAULT_LATENCY = { read: [90, 260], write: [140, 340] } as const

function abortError(): DOMException {
  return new DOMException('The operation was aborted.', 'AbortError')
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError'
}

function sleep(ms: number, signal: AbortSignal | undefined): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(abortError())
      return
    }
    const onAbort = () => {
      clearTimeout(timer)
      reject(abortError())
    }
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort)
      resolve()
    }, ms)
    signal?.addEventListener('abort', onAbort, { once: true })
  })
}

/** What crossing the wire does to a value: a deep copy. `FormData` is not
 *  cloneable and is only ever read, so it passes through as itself. */
function overTheWire<V>(value: V): V {
  if (typeof FormData !== 'undefined' && value instanceof FormData) return value
  return structuredClone(value)
}

function normaliseParams(raw: Record<string, unknown> | undefined, into: DemoParams): DemoParams {
  for (const [key, value] of Object.entries(raw ?? {})) {
    if (value === null || value === undefined || value === '') continue
    into[key] = String(value)
  }
  return into
}

function capture(route: Route, segments: string[]): Record<string, string> | null {
  if (route.segments.length !== segments.length) return null

  const captured: Record<string, string> = {}
  for (let index = 0; index < segments.length; index += 1) {
    const expected = route.segments[index]
    const actual = segments[index]
    if (expected === undefined || actual === undefined) return null
    if (expected.startsWith(':')) {
      if (!actual) return null
      captured[expected.slice(1)] = decodeURIComponent(actual)
      continue
    }
    if (expected !== actual) return null
  }
  return captured
}

/**
 * Build one demo's API. Each demo creates exactly one, in `demo/api.ts`, and
 * its handler modules import it to register against.
 */
export function createMockApi(options: MockApiOptions): MockApi {
  // `/api/` and `/api` strip the same way; matching keeps the leading slash.
  const prefix = (options.prefix ?? '').replace(/\/+$/, '')
  const latency = options.latency ?? DEFAULT_LATENCY
  const publicPrefixes = options.publicPrefixes ?? ['/auth/']
  const table: Route[] = []

  function register(method: HttpMethod, pattern: string, handler: DemoHandler, routeOptions: RouteOptions = {}): void {
    const segments = pattern.split('/')
    const route: Route = {
      method,
      pattern,
      segments,
      literals: segments.filter((segment) => !segment.startsWith(':')).length,
      requiresAuth:
        routeOptions.requiresAuth ?? !publicPrefixes.some((open) => pattern.startsWith(open)),
      handler,
    }

    const existing = table.findIndex((entry) => entry.method === method && entry.pattern === pattern)
    if (existing >= 0) table[existing] = route
    else table.push(route)
  }

  function resolve(method: string, segments: string[]): Match {
    if (table.length === 0) {
      throw new DemoApiError(500, 'No demo handlers are registered — import the handler modules before the first request.')
    }

    let best: Match | null = null
    let otherMethod = false

    for (const route of table) {
      const path = capture(route, segments)
      if (path === null) continue
      if (route.method !== method) {
        otherMethod = true
        continue
      }
      if (!best || route.literals > best.route.literals) best = { route, path }
    }

    if (best) return best
    if (otherMethod) throw new DemoApiError(405, `Method "${method}" not allowed.`)
    throw notFound()
  }

  function stripPrefix(rawPath: string): string {
    // Only at a segment boundary: `/api` must not eat the front of `/apiary`.
    if (prefix && (rawPath === prefix || rawPath.startsWith(`${prefix}/`))) {
      return rawPath.slice(prefix.length)
    }
    return rawPath
  }

  async function dispatch<T = unknown>(method: string, path: string, request: DispatchOptions = {}): Promise<T> {
    const verb = method.toUpperCase()
    const queryAt = path.indexOf('?')
    const rawPath = queryAt >= 0 ? path.slice(0, queryAt) : path
    const query = queryAt >= 0 ? path.slice(queryAt + 1) : ''
    const local = stripPrefix(rawPath)
    const segments = (local.startsWith('/') ? local : `/${local}`).split('/')

    const params = normaliseParams(
      request.params,
      normaliseParams(Object.fromEntries(new URLSearchParams(query)), {}),
    )

    // The delay is the whole point of the mock feeling real: it is what makes
    // spinners, optimistic writes and stale-while-revalidate visible.
    const [min, max] = verb === 'GET' ? latency.read : latency.write
    await sleep(min + Math.random() * Math.max(0, max - min), request.signal)

    const { route, path: captured } = resolve(verb, segments)
    if (route.requiresAuth && !options.isAuthenticated()) {
      throw new DemoApiError(401, 'Authentication credentials were not provided.')
    }

    let result: unknown
    try {
      const raw = await route.handler({
        method: route.method,
        path: captured,
        params,
        body: overTheWire(request.body),
        signal: request.signal,
      })
      result = overTheWire(raw)
    } catch (error) {
      if (error instanceof DemoApiError || isAbortError(error)) throw error
      throw new DemoApiError(500, error instanceof Error ? error.message : 'The demo API failed.')
    }

    // A real response that lands after the caller aborted is never delivered.
    if (request.signal?.aborted) throw abortError()

    // `undefined` is how a handler says 204; the client reads that as null.
    return (result ?? null) as T
  }

  function routes(): RouteInfo[] {
    return table.map(({ method, pattern, requiresAuth }) => ({ method, pattern, requiresAuth }))
  }

  return { register, dispatch, routes }
}
