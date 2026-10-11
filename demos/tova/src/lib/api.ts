/**
 * The client every hook calls. It dispatches into the in-browser mock API
 * (`src/demo`); swapping `api.dispatch` for `fetch` is the only change a real
 * backend would need.
 *
 * Errors reject as `ApiError` (= demo-kit's `DemoApiError`): `.status`,
 * `.message` (an i18n key such as `play:errors.eventClosed`, translate it with
 * `t(err.message)`), `.fieldErrors` (field -> i18n keys).
 */
import { DemoApiError } from '@portfolio/demo-kit'

import { api } from '@/demo'

export { DemoApiError as ApiError }

export type Method = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
export type Params = Record<string, string | number | boolean | null | undefined>

export interface RequestOptions {
  body?: unknown
  params?: Params
  signal?: AbortSignal
}

export function request<T>(method: Method, path: string, options: RequestOptions = {}): Promise<T> {
  return api.dispatch<T>(method, `/api${path}`, options)
}

export const http = {
  get: <T,>(path: string, params?: Params, signal?: AbortSignal) => request<T>('GET', path, { params, signal }),
  post: <T,>(path: string, body?: unknown) => request<T>('POST', path, { body }),
  patch: <T,>(path: string, body?: unknown) => request<T>('PATCH', path, { body }),
  put: <T,>(path: string, body?: unknown) => request<T>('PUT', path, { body }),
  del: <T = void,>(path: string) => request<T>('DELETE', path),
}
