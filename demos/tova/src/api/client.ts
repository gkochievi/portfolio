/**
 * Owner: data agent. A thin, signal-aware facade over `@/lib/api` (which
 * dispatches into the in-browser mock API) plus the shared QueryClient.
 * Either import path works; both reach the same `api.dispatch`.
 *
 * Errors reject as `ApiError` (demo-kit's DemoApiError): `.status`,
 * `.message` (an i18n key such as `play:errors.eventClosed`) and
 * `.fieldErrors` (field -> i18n keys).
 */
import { ApiError, request, type Params } from '@/lib/api'

export { ApiError, http, request, type Method, type Params, type RequestOptions } from '@/lib/api'
export { queryClient } from '@/lib/queryClient'

export interface CallOptions {
  signal?: AbortSignal
}

export const api = {
  get: <T,>(path: string, options: CallOptions & { params?: Params } = {}) => request<T>('GET', path, options),
  post: <T,>(path: string, body?: unknown, options: CallOptions = {}) => request<T>('POST', path, { body, ...options }),
  put: <T,>(path: string, body?: unknown, options: CallOptions = {}) => request<T>('PUT', path, { body, ...options }),
  patch: <T,>(path: string, body?: unknown, options: CallOptions = {}) => request<T>('PATCH', path, { body, ...options }),
  delete: <T = void,>(path: string, options: CallOptions = {}) => request<T>('DELETE', path, options),
}

export const isApiError = (error: unknown): error is ApiError => error instanceof ApiError

/** The first i18n key for `field`, for an inline form error. */
export function fieldError(error: unknown, field: string): string | undefined {
  return isApiError(error) ? error.fieldErrors[field]?.[0] : undefined
}
