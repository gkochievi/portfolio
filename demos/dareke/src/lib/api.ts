/**
 * The client every query hook calls. Swap `mockApi.dispatch`
 * for `fetch` and nothing else changes. Paths are written WITHOUT "/api":
 * `get<CampaignWithStats[]>('/campaigns', { status })`.
 *
 * Every failure rejects with `ApiError` (the kit's DemoApiError): `status`,
 * `message` and `fieldErrors` (`{field: string[]}`) for inline form errors.
 */
import { DemoApiError, type HttpMethod } from '@portfolio/demo-kit'
import type { FieldValues, Path, UseFormSetError } from 'react-hook-form'

import { api as mockApi } from '@/demo'

export { DemoApiError as ApiError }

export type Params = Record<string, string | number | boolean | null | undefined>

export interface RequestOptions {
  body?: unknown
  params?: Params
  signal?: AbortSignal
}

export function request<T>(method: HttpMethod, path: string, options: RequestOptions = {}): Promise<T> {
  return mockApi.dispatch<T>(method, `/api${path}`, options)
}

export const get = <T,>(path: string, params?: Params, signal?: AbortSignal) => request<T>('GET', path, { params, signal })
export const post = <T,>(path: string, body?: unknown, signal?: AbortSignal) => request<T>('POST', path, { body, signal })
export const put = <T,>(path: string, body?: unknown, signal?: AbortSignal) => request<T>('PUT', path, { body, signal })
export const patch = <T,>(path: string, body?: unknown, signal?: AbortSignal) => request<T>('PATCH', path, { body, signal })
export const del = <T,>(path: string, params?: Params, signal?: AbortSignal) => request<T>('DELETE', path, { params, signal })

/** The same verbs as one object: `apiClient.get(...)`, `apiClient.delete(...)`. */
export const apiClient = { request, get, post, put, patch, delete: del }

export function isApiError(error: unknown): error is DemoApiError {
  return error instanceof DemoApiError
}

/** A message for a toast from anything a request rejected with. */
export function errorMessage(error: unknown): string {
  if (error instanceof DemoApiError) return error.message
  if (error instanceof Error) return error.message
  return String(error)
}

/** The first message per field (`{}` for non-validation errors). */
export function fieldErrors(error: unknown): Record<string, string> {
  if (!(error instanceof DemoApiError)) return {}
  const out: Record<string, string> = {}
  for (const [field, messages] of Object.entries(error.fieldErrors)) {
    const first = messages[0]
    if (first && field !== 'non_field_errors') out[field] = first
  }
  return out
}

/** Copy an API validation error onto a react-hook-form. Returns true when at least one field got a message. */
export function applyFieldErrors<T extends FieldValues>(error: unknown, setError: UseFormSetError<T>): boolean {
  const fields = fieldErrors(error)
  for (const [field, message] of Object.entries(fields)) setError(field as Path<T>, { type: 'server', message })
  return Object.keys(fields).length > 0
}
