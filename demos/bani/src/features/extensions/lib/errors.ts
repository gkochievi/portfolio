import type { TFunction } from 'i18next'

const KNOWN = new Set(['required', 'invalid_email', 'duplicate_email', 'no_reservation'])

/** The handler answers with short codes (`duplicate_email:5104`); turn them into words. */
export function translateError(message: string, t: TFunction<'extensions'>): string {
  const [code = '', arg] = message.split(':')
  if (!KNOWN.has(code)) return message || t('errors.generic')
  return t(`errors.${code}`, { number: arg })
}
