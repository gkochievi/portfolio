/**
 * The one HTTP-shaped client every screen calls. It speaks to the in-browser
 * mock API exactly the way it would speak to `fetch('/api/...')`:
 *
 *   const rows = await api.get<RecordingRow[]>('/recordings', { q: 'loan' }, signal)
 *   await api.post('/recordings/text', { title, language, text })
 *
 * Paths are relative to `/api`. Failures reject with a typed `ApiError`
 * (`status`, `message`, `fieldErrors`). The TanStack `queryClient` lives here
 * too: 15 s stale time, no retry on 4xx, one retry on a 5xx.
 */
import { ApiError, del, get, patch, post, put, request } from '@/lib/api'

export { ApiError, request }
export type { QueryParams, RequestOptions } from '@/lib/api'
export { queryClient } from '@/lib/queryClient'

export const api = { get, post, put, patch, delete: del } as const

export const isApiError = (error: unknown): error is ApiError => error instanceof ApiError

/** The first message for one form field, if the server rejected it. */
export function fieldError(error: unknown, field: string): string | undefined {
  return isApiError(error) ? error.fieldErrors[field]?.[0] : undefined
}

/** A message safe to put in a toast. */
export function errorMessage(error: unknown, fallback = 'Something went wrong.'): string {
  if (isApiError(error)) return error.message || fallback
  if (error instanceof Error && error.name !== 'AbortError') return error.message || fallback
  return fallback
}

/** True when a request was cancelled (navigation away, query unmounted). */
export const isAbort = (error: unknown): boolean => error instanceof DOMException && error.name === 'AbortError'
