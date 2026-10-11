import type { TFunction } from 'i18next'

import { ApiError } from '@/lib/api'

const CODES: Record<string, string> = {
  'No free seat': 'errors.noFreeSeat',
  license_in_use: 'errors.licenseInUse',
  license_has_mapped_users: 'errors.licenseHasMappedUsers',
  seats_below_mapped: 'errors.seatsBelowMapped',
  addon_not_mappable: 'errors.addonNotMappable',
  swap_needs_two_mapped_users: 'errors.swapNeedsTwo',
  swap_same_license: 'errors.swapSameLicense',
  key_already_revoked: 'errors.keyAlreadyRevoked',
}

/** Translated message for a mock-API error (licensing namespace `t`). */
export function errorText(t: TFunction, error: unknown): string {
  if (error instanceof ApiError) {
    const key = CODES[error.message]
    if (key) return t(key)
    const fields = (error as { fieldErrors?: Record<string, string[] | string> }).fieldErrors
    if (fields) {
      const first = Object.values(fields)[0]
      if (first) return Array.isArray(first) ? String(first[0]) : String(first)
    }
    return error.message
  }
  return t('errors.generic')
}

export function todayIso(): string {
  const d = new Date()
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}
