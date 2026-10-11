/**
 * The client every screen calls. It talks to the in-browser mock API exactly
 * the way it would talk to `fetch('/api/...')`. Owned by the shell agent.
 */
import { DemoApiError } from '@portfolio/demo-kit'

import { api } from '@/demo'

export class ApiError extends Error {
  readonly status: number
  readonly fieldErrors: Record<string, string[]>

  constructor(status: number, message: string, fieldErrors: Record<string, string[]> = {}) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.fieldErrors = fieldErrors
  }
}

export type QueryParams = Record<string, string | number | boolean | null | undefined>

export interface RequestOptions {
  body?: unknown
  params?: QueryParams
  signal?: AbortSignal
}

/** `path` is relative to `/api`, e.g. `request('GET', '/recordings')`. */
export async function request<T>(method: string, path: string, options: RequestOptions = {}): Promise<T> {
  try {
    return await api.dispatch<T>(method, `/api${path}`, options)
  } catch (error) {
    if (error instanceof DemoApiError) throw new ApiError(error.status, error.message, error.fieldErrors)
    throw error
  }
}

export const get = <T>(path: string, params?: QueryParams, signal?: AbortSignal) =>
  request<T>('GET', path, { params, signal })
export const post = <T>(path: string, body?: unknown) => request<T>('POST', path, { body })
export const put = <T>(path: string, body?: unknown) => request<T>('PUT', path, { body })
export const patch = <T>(path: string, body?: unknown) => request<T>('PATCH', path, { body })
export const del = <T>(path: string, body?: unknown) => request<T>('DELETE', path, { body })
