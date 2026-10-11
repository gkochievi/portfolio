/**
 * The client the UI calls. It dispatches to the in-browser mock API; swapping
 * `api.dispatch` for `fetch` is the only change a real backend would need.
 */
import { DemoApiError, type HttpMethod } from '@portfolio/demo-kit'

import { api } from '@/demo'

export { DemoApiError as ApiError }

export type QueryParams = Record<string, string | number | boolean | null | undefined>

export interface RequestOptions {
  body?: unknown
  params?: QueryParams
  signal?: AbortSignal
}

export function request<T>(method: HttpMethod, path: string, options: RequestOptions = {}): Promise<T> {
  return api.dispatch<T>(method, `/api${path}`, options)
}

export const http = {
  get: <T>(path: string, params?: QueryParams, signal?: AbortSignal) => request<T>('GET', path, { params, signal }),
  post: <T>(path: string, body?: unknown, signal?: AbortSignal) => request<T>('POST', path, { body, signal }),
  put: <T>(path: string, body?: unknown, signal?: AbortSignal) => request<T>('PUT', path, { body, signal }),
  patch: <T>(path: string, body?: unknown, signal?: AbortSignal) => request<T>('PATCH', path, { body, signal }),
  del: <T = void>(path: string, body?: unknown, signal?: AbortSignal) => request<T>('DELETE', path, { body, signal }),
}

/** A readable message for any error a request can reject with (toasts, banners). */
export function errorMessage(error: unknown, fallback = 'Something went wrong'): string {
  if (error instanceof DemoApiError) return error.message || fallback
  if (error instanceof Error && error.name !== 'AbortError') return error.message || fallback
  return fallback
}
