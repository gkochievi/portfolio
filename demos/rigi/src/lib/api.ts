/**
 * The only door from the UI to the mock backend. Owner: shell.
 * Paths are written WITHOUT the /api prefix: `http.get('/tasks', { state })`.
 * Swap `api.dispatch` for `fetch` and nothing else in the UI changes.
 *
 * Every response passes through `localizeResponse`, the one place seeded English
 * text becomes Georgian (see src/demo/ka/localize.ts). Request bodies and
 * thrown errors are untouched.
 */
import { DemoApiError, type HttpMethod } from '@portfolio/demo-kit'

import { api } from '@/demo'
import { localizeResponse } from '@/demo/ka/localize'

export { DemoApiError as ApiError }

export type QueryParams = Record<string, string | number | boolean | null | undefined>

export interface RequestOptions {
  body?: unknown
  params?: QueryParams
  signal?: AbortSignal
}

export function request<T>(method: HttpMethod, path: string, options: RequestOptions = {}): Promise<T> {
  // Under `?lang=ka` every response is run through the Georgian text layer (src/demo/ka); a no-op in English.
  return api.dispatch<T>(method, `/api${path}`, options).then(localizeResponse)
}

export const http = {
  get: <T>(path: string, params?: QueryParams, signal?: AbortSignal) => request<T>('GET', path, { params, signal }),
  post: <T>(path: string, body?: unknown) => request<T>('POST', path, { body }),
  put: <T>(path: string, body?: unknown) => request<T>('PUT', path, { body }),
  patch: <T>(path: string, body?: unknown) => request<T>('PATCH', path, { body }),
  del: <T>(path: string, body?: unknown) => request<T>('DELETE', path, { body }),
}

/** True when `error` is a mock-API error with this status (and optional message). */
export function isApiError(error: unknown, status?: number, message?: string): error is DemoApiError {
  if (!(error instanceof DemoApiError)) return false
  if (status !== undefined && error.status !== status) return false
  if (message !== undefined && error.message !== message) return false
  return true
}
