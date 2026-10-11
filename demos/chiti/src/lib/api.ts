/**
 * The only way the UI talks to the backend. Same shape it would have against
 * a real server; `dispatch` stands where `fetch` would. Paths are WITHOUT the
 * `/api` prefix: `request('GET', '/operator/inbox')`.
 */
import { DemoApiError, type HttpMethod } from '@portfolio/demo-kit'

import { api } from '@/demo/api'

export type RequestParams = Record<string, string | number | boolean | null | undefined>

export interface RequestOptions {
  body?: unknown
  params?: RequestParams
  signal?: AbortSignal
}

export function request<T>(method: HttpMethod, path: string, options: RequestOptions = {}): Promise<T> {
  const local = path.startsWith('/') ? path : `/${path}`
  return api.dispatch<T>(method, `/api${local}`, { body: options.body, params: options.params, signal: options.signal })
}

export { DemoApiError as ApiError }
export type { HttpMethod }

export function isApiError(error: unknown): error is DemoApiError {
  return error instanceof DemoApiError
}

/** A message fit for a toast. */
export function errorMessage(error: unknown, fallback = 'Something went wrong. Please try again.'): string {
  if (error instanceof DemoApiError) return error.message || fallback
  if (error instanceof Error && error.name !== 'AbortError') return error.message || fallback
  return fallback
}

/** The first message for one form field, for inline errors. */
export function fieldError(error: unknown, field: string): string | undefined {
  return error instanceof DemoApiError ? error.fieldErrors[field]?.[0] : undefined
}
