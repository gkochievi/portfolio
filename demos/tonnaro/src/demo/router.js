/**
 * Request dispatch for the in-browser API. `api/client.js` calls `dispatch()`;
 * the handler modules fill the registry below.
 *
 * ## Handler contract
 *
 * ```js
 * register('GET', '/orders/admin/:id/', (req) => serializeOrder(mustFindOrder(req)), { auth: 'admin' })
 * ```
 *
 * - Patterns are matched *after* the `/api` prefix and keep DRF's trailing
 *   slash, because that is the path the app asks for. `api/client.js` had
 *   `baseURL: '/api'`, so paths arrive here already stripped; the prefix is
 *   tolerated anyway so a hand-written path cannot silently 404.
 * - `:name` captures exactly one segment; captures arrive as strings on
 *   `req.path` (`req.path.id`). A literal segment always beats a capture, so
 *   `/orders/active/` and `/orders/:id/` can coexist.
 * - `req.params` is the query string, normalised the way axios would have
 *   serialised it: blank, null and undefined values are dropped. A repeated
 *   key (axios sends arrays as `?k=a&k=b`) is kept in `req.paramsAll`.
 * - `req.body` is whatever the caller handed `api.post` — a plain object, or
 *   the `FormData` the order form and every image upload posts. Handlers
 *   narrow it themselves via `readBody()`.
 * - `req.user` is the signed-in user row, or null. The gate below has already
 *   rejected the request if the route needed one.
 * - Return the payload. `undefined` becomes `null`, which is how a 204 reads.
 *   Return a `FileResponse` (see `file()`) to answer with a real Blob.
 * - Fail by throwing `DemoApiError`. `DemoApiError.validation({field: 'msg'})`
 *   is the 400 whose field errors the existing Ant Design forms render inline;
 *   anything else that escapes a handler becomes a 500 with its message.
 * - Do not sleep, catch your own errors or reshape them. Latency and error
 *   shaping live here so the handler modules stay declarative.
 *
 * Handlers register on import, so they must be pulled in exactly once:
 * `import './demo/handlers'`.
 */
import { userForAccessToken } from './auth'

/* ----------------------------------------------------------------- errors */

export class DemoApiError extends Error {
  constructor(status, message, data = null) {
    super(message)
    this.name = 'DemoApiError'
    this.status = status
    // DRF puts a bare message under `detail` and field errors at the top
    // level. `data` is the literal response body, because that is what every
    // `err.response.data` read site upstream is looking at.
    this.data = data ?? { detail: message }
  }

  /**
   * The 400 a DRF serializer raises: `{field: ['message']}` at the top level,
   * which is the shape `utils/registerErrors.js` and every Ant Design form
   * that renders `setFields` already understands.
   */
  static validation(fields) {
    const body = Object.fromEntries(
      Object.entries(fields).map(([field, value]) => [
        field,
        Array.isArray(value) ? value.map(String) : [String(value)],
      ]),
    )
    const first = Object.values(body)[0]
    return new DemoApiError(400, (first && first[0]) || 'Invalid input.', body)
  }
}

export function notFound(detail = 'Not found.') {
  return new DemoApiError(404, detail)
}

export function permissionDenied(detail = 'You do not have permission to perform this action.') {
  return new DemoApiError(403, detail)
}

/* ------------------------------------------------------------ file replies */

const FILE = Symbol('demo.file')

/**
 * What a handler returns in place of an attachment response. `api/client.js`
 * unwraps it into the `{data: Blob, headers}` pair the CSV export buttons read
 * `content-disposition` off.
 */
export function file(blob, filename, contentType = 'text/csv; charset=utf-8') {
  return { [FILE]: true, blob, filename, contentType }
}

export function isFileResponse(value) {
  return Boolean(value && typeof value === 'object' && value[FILE])
}

/* ---------------------------------------------------------------- registry */

const API_PREFIX = '/api'
const READ_LATENCY = [90, 260]
const WRITE_LATENCY = [140, 340]

/** Role required to reach a route. `any` means "signed in, role irrelevant". */
const ROLES = new Set(['public', 'any', 'customer', 'admin'])

const routes = []

export function register(method, pattern, handler, options = {}) {
  const auth = options.auth ?? 'any'
  if (!ROLES.has(auth)) throw new Error(`Unknown auth level "${auth}" on ${method} ${pattern}`)

  const segments = pattern.split('/')
  const route = {
    method,
    pattern,
    segments,
    // Literal segments beat captures when two patterns match the same path.
    literals: segments.filter((segment) => !segment.startsWith(':')).length,
    auth,
    handler,
  }

  // Replacing rather than appending keeps a hot module reload from stacking
  // two handlers on one route.
  const existing = routes.findIndex((entry) => entry.method === method && entry.pattern === pattern)
  if (existing >= 0) routes[existing] = route
  else routes.push(route)
}

function capture(route, segments) {
  if (route.segments.length !== segments.length) return null

  const captured = {}
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

function resolve(method, segments) {
  if (routes.length === 0) {
    throw new DemoApiError(500, 'No demo handlers are registered — import "./demo/handlers" first.')
  }

  let best = null
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

/* ---------------------------------------------------------------- dispatch */

/**
 * axios serialises `{a: 1, b: [2, 3], c: null}` as `?a=1&b=2&b=3` — null,
 * undefined and '' are dropped, everything else is stringified. Reproducing
 * that here means a handler reads exactly what Django's `request.GET` held.
 */
function normaliseParams(raw, single, multi) {
  for (const [key, value] of Object.entries(raw ?? {})) {
    if (value === null || value === undefined || value === '') continue
    const values = Array.isArray(value) ? value : [value]
    for (const item of values) {
      if (item === null || item === undefined || item === '') continue
      const text = String(item)
      single[key] = text
      ;(multi[key] ??= []).push(text)
    }
  }
}

function sleep(ms) {
  return new Promise((done) => {
    window.setTimeout(done, ms)
  })
}

/**
 * Run one request against the mock. Rejects with a `DemoApiError` that
 * `api/client.js` re-dresses as the axios-shaped error every call site
 * upstream already catches.
 */
export async function dispatch(method, path, options = {}) {
  const verb = String(method).toUpperCase()
  const [rawPath = '', queryString = ''] = String(path).split('?')
  const withoutPrefix = rawPath.startsWith(API_PREFIX) ? rawPath.slice(API_PREFIX.length) : rawPath
  const segments = (withoutPrefix.startsWith('/') ? withoutPrefix : `/${withoutPrefix}`).split('/')

  // A path may already carry a query string; explicit params win over it.
  const params = {}
  const paramsAll = {}
  normaliseParams(Object.fromEntries(new URLSearchParams(queryString)), params, paramsAll)
  normaliseParams(options.params, params, paramsAll)

  // The delay is the whole point of the mock feeling real: it is what makes
  // spinners, optimistic writes and Ant Design's table loading state visible
  // instead of theoretical.
  const [min, max] = verb === 'GET' ? READ_LATENCY : WRITE_LATENCY
  await sleep(min + Math.random() * (max - min))

  const { route, path: captured } = resolve(verb, segments)

  // One resolution for the whole request: a token that no longer names a real
  // row reads as signed out, exactly as a JWT for a deleted user would.
  const user = userForAccessToken(options.token)

  if (route.auth !== 'public') {
    if (!user) {
      throw new DemoApiError(401, 'Authentication credentials were not provided.', {
        detail: 'Authentication credentials were not provided.',
      })
    }
    if (route.auth !== 'any' && user.role !== route.auth) {
      throw permissionDenied()
    }
  }

  let result
  try {
    result = await route.handler({
      method: verb,
      path: captured,
      params,
      paramsAll,
      body: options.body,
      headers: options.headers ?? {},
      user,
    })
  } catch (error) {
    if (error instanceof DemoApiError) throw error
    throw new DemoApiError(500, error instanceof Error ? error.message : 'The demo API failed.')
  }

  // `undefined` is how a handler says 204; every call site reads that as null.
  return result ?? null
}
