/**
 * The client every query hook calls. It keeps the shape it would have had
 * against a real backend; `api.dispatch` stands where `fetch` would be.
 *
 * Owner: seed agent.
 */
import { DemoApiError, type HttpMethod } from '@portfolio/demo-kit'

import { api } from '@/demo/core'

export type QueryParams = Record<string, string | number | boolean | null | undefined>

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

export interface RequestOptions {
  body?: unknown
  params?: QueryParams
  signal?: AbortSignal
}

/** `request('GET', '/console/links', { params })` -> dispatches `/api/console/links`. */
export async function request<T>(method: HttpMethod, path: string, options: RequestOptions = {}): Promise<T> {
  try {
    return await api.dispatch<T>(method, `/api${path}`, {
      body: options.body,
      params: options.params,
      signal: options.signal,
    })
  } catch (error) {
    if (error instanceof DemoApiError) throw new ApiError(error.status, error.message, error.fieldErrors)
    throw error
  }
}
