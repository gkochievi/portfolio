/**
 * Request dispatch for the in-browser API. `lib/api.ts` calls `dispatch()`;
 * the handler modules fill the registry below.
 *
 * ## Handler contract
 *
 * ```ts
 * register('GET', '/devices/:id/', (req) => serializeDevice(mustFindDevice(req)))
 * ```
 *
 * - Patterns are matched *after* the `/api/admin` prefix and keep DRF's
 *   trailing slash, because that is the path the console asks for.
 * - `:name` captures exactly one segment; captures arrive as strings on
 *   `req.path` (`req.path.id`). A literal segment always beats a capture, so
 *   `/photos/download/` and `/photos/:id/` can coexist.
 * - `req.params` is the query string, normalised to strings the way `fetch`
 *   would have serialised it: blank, null and undefined values are dropped.
 * - `req.body` is whatever `lib/api.ts` was handed — a parsed JSON value, or
 *   the `FormData` the campaign form posts. Handlers narrow it themselves.
 * - Return the payload. `undefined` becomes `null`, which is how a 204 reads
 *   on the wire.
 * - Fail by throwing `DemoApiError`. `DemoApiError.validation({field: 'msg'})`
 *   is the 400 whose `fieldErrors` the existing forms render inline; anything
 *   else that escapes a handler becomes a 500 with its message.
 * - Every route needs a signed-in session except those under `/auth/`; pass
 *   `{requiresAuth: false}` to opt out.
 * - Do not sleep, catch your own errors or reshape them. Latency and error
 *   shaping live here so the three handler modules stay declarative.
 *
 * Handlers register on import, so they must be pulled in exactly once:
 * `import '@/demo/handlers'`.
 */
import { isSignedIn } from '@/demo/store'

export type FieldErrors = Record<string, string[]>
/** Handlers may write a bare string per field; DRF would have listed it. */
export type FieldErrorInput = Record<string, string | string[]>

export class DemoApiError extends Error {
  readonly status: number
  readonly fieldErrors: FieldErrors

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

  /** The 400 a DRF serializer raises: field errors plus the first of them as
   *  the human-readable message. */
  static validation(fields: FieldErrorInput): DemoApiError {
    const first = Object.values(fields)[0]
    const message = Array.isArray(first) ? first[0] : first
    return new DemoApiError(400, message ?? 'Invalid input.', fields)
  }
}

export function notFound(detail = 'Not found.'): DemoApiError {
  return new DemoApiError(404, detail)
}

export type HttpMethod = 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE'
export type DemoParams = Record<string, string>

export interface DemoRequest {
  method: HttpMethod
  /** Captured `:name` segments, e.g. `{id: '3'}`. */
  path: Record<string, string>
  params: DemoParams
  body: unknown
  signal?: AbortSignal
}

export type DemoHandler = (request: DemoRequest) => unknown

export interface RouteOptions {
  /** Defaults to true for everything outside `/auth/`. */
  requiresAuth?: boolean
}

interface Route {
  method: HttpMethod
  pattern: string
  segments: string[]
  /** Literal segments beat captures when two patterns match the same path. */
  literals: number
  requiresAuth: boolean
  handler: DemoHandler
}

const API_PREFIX = '/api/admin'
const READ_METHODS = new Set<HttpMethod>(['GET'])
const READ_LATENCY = [90, 260] as const
const WRITE_LATENCY = [140, 340] as const

const routes: Route[] = []

export function register(
  method: HttpMethod,
  pattern: string,
  handler: DemoHandler,
  options: RouteOptions = {},
): void {
  const segments = pattern.split('/')
  const route: Route = {
    method,
    pattern,
    segments,
    literals: segments.filter((segment) => !segment.startsWith(':')).length,
    requiresAuth: options.requiresAuth ?? !pattern.startsWith('/auth/'),
    handler,
  }

  // Replacing rather than appending keeps a hot module reload from stacking
  // two handlers on one route.
  const existing = routes.findIndex((entry) => entry.method === method && entry.pattern === pattern)
  if (existing >= 0) routes[existing] = route
  else routes.push(route)
}

function capture(route: Route, segments: string[]): Record<string, string> | null {
  if (route.segments.length !== segments.length) return null

  const captured: Record<string, string> = {}
  for (let index = 0; index < segments.length; index += 1) {
    const pattern = route.segments[index]
    if (pattern.startsWith(':')) {
      if (!segments[index]) return null
      captured[pattern.slice(1)] = decodeURIComponent(segments[index])
      continue
    }
    if (pattern !== segments[index]) return null
  }
  return captured
}

interface Match {
  route: Route
  path: Record<string, string>
}

function resolve(method: HttpMethod, segments: string[]): Match {
  if (routes.length === 0) {
    throw new DemoApiError(500, 'No demo handlers are registered — import "@/demo/handlers" first.')
  }

  let best: Match | null = null
  let otherMethod = false

  for (const route of routes) {
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

function normaliseParams(raw: Record<string, unknown> | undefined, into: DemoParams): DemoParams {
  for (const [key, value] of Object.entries(raw ?? {})) {
    if (value === null || value === undefined || value === '') continue
    into[key] = String(value)
  }
  return into
}

function aborted(): DOMException {
  return new DOMException('The operation was aborted.', 'AbortError')
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve_, reject) => {
    if (signal?.aborted) {
      reject(aborted())
      return
    }
    const onAbort = () => {
      window.clearTimeout(timer)
      reject(aborted())
    }
    const timer = window.setTimeout(() => {
      signal?.removeEventListener('abort', onAbort)
      resolve_()
    }, ms)
    signal?.addEventListener('abort', onAbort, { once: true })
  })
}

export interface DispatchOptions {
  params?: Record<string, string | number | boolean | null | undefined>
  body?: unknown
  signal?: AbortSignal
}

/**
 * Run one request against the mock. Rejects with a `DemoApiError` that
 * `lib/api.ts` turns into the `ApiError` the console already understands, or
 * with an `AbortError` when the caller's signal fires.
 */
export async function dispatch<T = unknown>(
  method: string,
  path: string,
  options: DispatchOptions = {},
): Promise<T> {
  const verb = method.toUpperCase() as HttpMethod
  const [rawPath = '', queryString = ''] = path.split('?')
  const withoutPrefix = rawPath.startsWith(API_PREFIX) ? rawPath.slice(API_PREFIX.length) : rawPath
  const segments = (withoutPrefix.startsWith('/') ? withoutPrefix : `/${withoutPrefix}`).split('/')

  // A path may already carry a query string; explicit params win over it.
  const params = normaliseParams(
    options.params,
    normaliseParams(Object.fromEntries(new URLSearchParams(queryString)), {}),
  )

  // The delay is the whole point of the mock feeling real: it is what makes
  // spinners, optimistic writes and stale-while-revalidate visible.
  const [min, max] = READ_METHODS.has(verb) ? READ_LATENCY : WRITE_LATENCY
  await sleep(min + Math.random() * (max - min), options.signal)

  const { route, path: captured } = resolve(verb, segments)
  if (route.requiresAuth && !isSignedIn()) {
    throw new DemoApiError(401, 'Authentication credentials were not provided.')
  }

  let result: unknown
  try {
    result = await route.handler({
      method: verb,
      path: captured,
      params,
      body: options.body,
      signal: options.signal,
    })
  } catch (error) {
    if (error instanceof DemoApiError || error instanceof DOMException) throw error
    throw new DemoApiError(500, error instanceof Error ? error.message : 'The demo API failed.')
  }

  // `undefined` is how a handler says 204; the console reads that as null.
  return (result ?? null) as T
}
