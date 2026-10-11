/**
 * Verb-style convenience over the API client. Everything goes through
 * `request()` in `@/lib/api`, which calls `mockApi.dispatch` (where `fetch`
 * would be) and turns a `DemoApiError` into a typed `ApiError` with
 * `fieldErrors`. Paths are written WITHOUT the `/api` prefix.
 *
 *   api.get<Page<LinkRow>>('/console/links', { params: { status: 'pending' }, signal })
 *   api.post<ApiEnvelope<ValidateData>>('/surveys/validate', { survey_id: id, lang })
 *
 * The TanStack client is the app's single `queryClient` (`@/lib/queryClient`).
 *
 * Owner: seed agent.
 */
import type { FieldErrors } from '@portfolio/demo-kit'

import { ApiError, request, type QueryParams } from '@/lib/api'

export { ApiError, request, type QueryParams, type RequestOptions } from '@/lib/api'
export { queryClient } from '@/lib/queryClient'

export interface CallOptions {
  params?: QueryParams
  signal?: AbortSignal
}

export const api = {
  get: <T>(path: string, options: CallOptions = {}) => request<T>('GET', path, options),
  post: <T>(path: string, body?: unknown, options: CallOptions = {}) => request<T>('POST', path, { ...options, body }),
  put: <T>(path: string, body?: unknown, options: CallOptions = {}) => request<T>('PUT', path, { ...options, body }),
  patch: <T>(path: string, body?: unknown, options: CallOptions = {}) => request<T>('PATCH', path, { ...options, body }),
  delete: <T>(path: string, options: CallOptions = {}) => request<T>('DELETE', path, options),
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError
}

/** The first message for `field` (or the summary), for inline form errors. */
export function fieldError(error: unknown, field: string): string | undefined {
  if (!isApiError(error)) return undefined
  const errors: FieldErrors = error.fieldErrors
  return errors[field]?.[0]
}
