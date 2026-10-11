import type { TFunction } from 'i18next'

import { ApiError } from '@/lib/api'

const KNOWN = ['invoice_invalid_transition', 'invoice_already_void', 'invoice_has_no_lines', 'invoice_duplicate_period'] as const

/** First message for one field of a validation error (e.g. `title`, `lines.0.quantity`), if any. */
export function fieldErrorOf(error: unknown, field: string): string | undefined {
  if (!(error instanceof ApiError)) return undefined
  const value = (error.fieldErrors as Record<string, unknown> | undefined)?.[field]
  if (Array.isArray(value)) return value.length ? String(value[0]) : undefined
  return typeof value === 'string' ? value : undefined
}

/** A readable, translated message for a mock-API error (field errors first). */
export function errorMessage(t: TFunction, error: unknown): string {
  if (error instanceof ApiError) {
    if ((KNOWN as readonly string[]).includes(error.message)) return t(`invoicing:errors.${error.message}`)
    if (error.status === 403) return t('invoicing:errors.forbidden')
    const first = Object.values(error.fieldErrors ?? {})[0]
    if (first && first.length) return String(first[0])
    return error.message
  }
  return t('common:states.error')
}
