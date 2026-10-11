/**
 * The typed API client for features that prefer an `api.get(...)` shape.
 * Owner: data core.
 *
 * This is a thin, typed face over `@/lib/api` (the one door to the mock
 * backend: `mockApi.dispatch`, with AbortSignal support) and
 * `@/lib/queryClient` (the single TanStack client). It adds nothing at runtime
 * that could drift from them: there is exactly one `queryClient`, one
 * dispatcher and one `ApiError`.
 *
 *   api.get<Task[]>('/tasks', { state: 'accepted' }, signal)
 *   api.post<Task>('/tasks', body)
 *
 * Paths are written WITHOUT the `/api` prefix. Failures reject with an
 * `ApiError` (demo-kit's `DemoApiError`): `status`, `message` and
 * `fieldErrors` (`{ field: string[] }`, for inline form errors).
 */
import { ApiError, http, isApiError, type QueryParams } from '@/lib/api'
import { queryClient } from '@/lib/queryClient'
import type { ChangedEntity } from '@/demo/events'

export { ApiError, isApiError, queryClient }
export type { QueryParams }

export const api = {
  get: http.get,
  post: http.post,
  put: http.put,
  patch: http.patch,
  delete: http.del,
}

/** First message per field, ready for react-hook-form `setError` / `<Field error>`. */
export function fieldErrorsOf(error: unknown): Record<string, string> {
  if (!isApiError(error)) return {}
  const out: Record<string, string> = {}
  for (const [field, messages] of Object.entries(error.fieldErrors)) {
    const first = messages[0]
    if (first) out[field] = first
  }
  return out
}

/** A message safe to show in a toast for any thrown value. */
export function errorMessage(error: unknown, fallback = 'Something went wrong.'): string {
  if (error instanceof Error && error.message) return error.message
  return fallback
}

/** True for the abort a cancelled query or unmounted page raises. */
export function isAbort(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError'
}

/** Refetch every query whose first key segment is one of `entities` (what the shell does on `changed`). */
export function invalidateEntities(...entities: ChangedEntity[]): Promise<void> {
  const roots = new Set<unknown>(entities)
  return queryClient.invalidateQueries({ predicate: (query) => roots.has(query.queryKey[0]) })
}
