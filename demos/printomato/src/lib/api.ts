/**
 * The seam.
 *
 * Every call the console makes still arrives here with the same signature it
 * had against Django; what changed is the other side. Instead of `fetch()`, a
 * request is dispatched to the in-browser mock, and the `DemoApiError` a
 * handler throws is re-dressed as the `ApiError` the pages, forms and query
 * hooks upstream already know how to render. Nothing above this file moved.
 */
import { DemoApiError, dispatch } from '@/demo/router'
import { setSignedIn } from '@/demo/store'
import type { PhotoArchive } from '@/demo/zip'
import '@/demo/handlers'

import { API_BASE, APP_BASE } from './bootstrap'

export type FieldErrors = Record<string, string[]>

export class ApiError extends Error {
  readonly status: number
  readonly fieldErrors: FieldErrors

  constructor(status: number, message: string, fieldErrors: FieldErrors = {}) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.fieldErrors = fieldErrors
  }

  /** First message recorded against a specific form field, if any. */
  fieldError(name: string): string | undefined {
    return this.fieldErrors[name]?.[0]
  }
}

/**
 * Part of this module's contract, kept so nothing upstream has to care that the
 * transport changed. Without a Django session there is nothing to protect, and
 * a request that never leaves the tab cannot be forged.
 */
export function csrfToken(): string {
  return 'demo'
}

const HASH_ROUTING = __DEMO_ROUTER__ === 'hash'

export interface RequestOptions {
  method?: string
  body?: unknown
  params?: Record<string, string | number | boolean | null | undefined>
  signal?: AbortSignal
  /** Bypass the automatic redirect-to-login on a 401. */
  allowUnauthenticated?: boolean
}

/**
 * `next` is always stored as an app-relative path (no APP_BASE prefix), because
 * that is what React Router resolves against its basename.
 */
export function toAppRelative(pathname: string): string {
  if (APP_BASE && pathname.startsWith(APP_BASE)) {
    return pathname.slice(APP_BASE.length) || '/'
  }
  return pathname
}

/** Where the operator is inside the console, whichever router is in play. */
function appLocation(): string {
  if (HASH_ROUTING) return window.location.hash.slice(1) || '/'
  return toAppRelative(window.location.pathname) + window.location.search
}

function onUnauthenticated(): void {
  const next = appLocation()
  if (next.startsWith('/login')) return
  // APP_BASE already carries the '#' under hash routing, so this one string
  // works for both routers.
  window.location.assign(`${APP_BASE}/login?next=${encodeURIComponent(next)}`)
}

// Signing out is a real page load under the browser router, and the store that
// comes back is pristine — which means signed in, which would bounce the
// operator straight back to the dashboard they just left. Booting on the login
// route is the only evidence of that intent that survives the reload.
if (appLocation().startsWith('/login')) {
  setSignedIn(false)
}

/**
 * A handler's failure, wearing the console's error type. Anything that is not a
 * `DemoApiError` — an `AbortError`, above all — is passed through untouched:
 * TanStack Query recognises it by identity.
 */
function asApiError(error: unknown, allowUnauthenticated?: boolean): unknown {
  if (!(error instanceof DemoApiError)) return error

  const sessionLost =
    error.status === 401 ||
    (error.status === 403 && /credentials were not provided|not authenticated/i.test(error.message))
  if (sessionLost && !allowUnauthenticated) {
    onUnauthenticated()
  }

  return new ApiError(error.status, error.message, error.fieldErrors)
}

export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const method = (options.method ?? 'GET').toUpperCase()
  try {
    return await dispatch<T>(method, `${API_BASE}${path}`, {
      params: options.params,
      body: options.body,
      signal: options.signal,
    })
  } catch (error) {
    throw asApiError(error, options.allowUnauthenticated)
  }
}

export const api = {
  get: <T>(path: string, params?: RequestOptions['params'], signal?: AbortSignal) =>
    request<T>(path, { params, signal }),
  post: <T>(path: string, body?: unknown) => request<T>(path, { method: 'POST', body }),
  patch: <T>(path: string, body?: unknown) => request<T>(path, { method: 'PATCH', body }),
  put: <T>(path: string, body?: unknown) => request<T>(path, { method: 'PUT', body }),
  delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
}

/**
 * What a download route resolves to in place of an attachment response: the
 * archive `demo/zip.ts` built, the name `Content-Disposition` carried, and the
 * count the real endpoint returned in its `X-Photo-Count` header.
 */
function asArchive(result: unknown): PhotoArchive | null {
  const archive = result as PhotoArchive | null
  return archive && archive.blob instanceof Blob ? archive : null
}

/** Build a zip in the tab and hand it to the browser as a real download. */
export async function download(
  path: string,
  options: { method?: string; body?: unknown; params?: RequestOptions['params'] } = {},
): Promise<number> {
  const method = (options.method ?? 'GET').toUpperCase()

  let result: unknown
  try {
    result = await dispatch(method, `${API_BASE}${path}`, {
      params: options.params,
      body: options.body,
    })
  } catch (error) {
    throw asApiError(error)
  }

  const archive = asArchive(result)
  if (!archive) {
    throw new ApiError(500, 'The demo could not build that archive.')
  }

  const url = URL.createObjectURL(archive.blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = archive.filename || 'printomato-photos.zip'
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()

  // Give Safari a beat before revoking, otherwise the download aborts.
  setTimeout(() => URL.revokeObjectURL(url), 4000)
  return archive.count
}
