/**
 * Audit-log details are stored as English system text. In Georgian the known shapes are rendered
 * from translations; anything unrecognised is shown as stored.
 */
import type { TFunction } from 'i18next'

type Rule = [RegExp, (m: RegExpMatchArray, t: TFunction<'extensions'>) => string]

const RULES: Rule[] = [
  [/^Reserved (\d+) \(lock 10 min\)$/, (m, t) => t('activity.d.reserved', { number: m[1] })],
  [/^Created (\d+) for (.+)$/, (m, t) => t('activity.d.created', { number: m[1], email: m[2] })],
  [/^Lock on (\d+) expired after 10 min, released$/, (m, t) => t('activity.d.expired', { number: m[1] })],
  [/^Released (\d+) without creating$/, (m, t) => t('activity.d.released', { number: m[1] })],
  [
    /^Create failed for (\d+): (.+) already has extension (\d+)$/,
    (m, t) => t('activity.d.failedDuplicate', { number: m[1], email: m[2], other: m[3] }),
  ],
  [/^Create failed for (\d+): secret is empty$/, (m, t) => t('activity.d.failedSecret', { number: m[1] })],
  [/^Create failed for (\d+): email is empty$/, (m, t) => t('activity.d.failedEmailEmpty', { number: m[1] })],
  [/^Create failed for (\d+): email is not valid$/, (m, t) => t('activity.d.failedEmailInvalid', { number: m[1] })],
  [/^Tab hidden while holding (\d+) \(lock kept until expiry\)$/, (m, t) => t('activity.d.hidden', { number: m[1] })],
  [/^Purged (\d+) entries older than 90 days$/, (m, t) => t('activity.d.purged', { count: Number(m[1]) })],
]

export function localizeDetails(details: string, t: TFunction<'extensions'>, lang: 'en' | 'ka'): string {
  if (lang === 'en') return details
  for (const [re, render] of RULES) {
    const match = details.match(re)
    if (match) return render(match, t)
  }
  return details
}
