/**
 * The client the UI calls. The implementation lives in `@/lib/api` (request /
 * http / ApiError) and `@/lib/queryClient` (the one TanStack client); this
 * module is the friendlier front door:
 *
 *   api.get<T>(path, params?, signal?)       api.post<T>(path, body?, signal?)
 *   api.put / api.patch                      api.delete<T>(path, body?, signal?)
 *
 * Every call is answered by the in-browser mock API (`api.dispatch`); a failure
 * rejects with `ApiError` (`status`, `message`, `fieldErrors`).
 */
import { ApiError, errorMessage, http } from '@/lib/api'

export { ApiError, errorMessage, http, request, type QueryParams, type RequestOptions } from '@/lib/api'
export { isApiError, queryClient } from '@/lib/queryClient'

export const api = {
  get: http.get,
  post: http.post,
  put: http.put,
  patch: http.patch,
  delete: http.del,
} as const

/** Per-field messages of a validation failure (first message per field); `{}` for any other error. */
export function fieldErrors(error: unknown): Record<string, string> {
  if (!(error instanceof ApiError)) return {}
  const out: Record<string, string> = {}
  for (const [field, messages] of Object.entries(error.fieldErrors)) {
    const first = messages[0]
    if (first) out[field] = first
  }
  return out
}

/** True for a deliberate access failure (401/403), so pages can show the forbidden state instead of a toast. */
export function isAccessError(error: unknown): boolean {
  return error instanceof ApiError && (error.status === 401 || error.status === 403)
}

export { errorMessage as messageOf }
