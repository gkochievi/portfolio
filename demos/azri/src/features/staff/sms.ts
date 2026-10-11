/**
 * The survey SMS text, shared by the send handler (what lands in the inbox)
 * and the live preview on the Send survey SMS page, so both always agree.
 *
 * Owner: feature group staff.
 */
import type { Branch, Lang, LocalizedText, Tenant } from '@/types'

export const SHORT_LINK_HOST = 'azri.example/s/'
export const PLACEHOLDER_TOKEN = '••••••'

/** Only the obviously fake pattern 5XX 00 00 XX is accepted (digits only). */
export const FAKE_PHONE_RE = /^5\d{2}0000\d{2}$/

export function shortLink(token: string): string {
  return `${SHORT_LINK_HOST}${token}`
}

export function smsBody(tenant: Tenant, branch: Branch | undefined, token: string): LocalizedText {
  const link = shortLink(token)
  const where = branch ? { en: ` (${branch.name.en})`, ka: ` (${branch.name.ka})` } : { en: '', ka: '' }
  return {
    en: `${tenant.name.en}: thank you for choosing us today${where.en}. How did we do? It takes 30 seconds: ${link}`,
    ka: `${tenant.name.ka}: გმადლობთ, რომ დღეს აგვირჩიეთ${where.ka}. გაგვიზიარეთ თქვენი აზრი, ამას 30 წამი დასჭირდება: ${link}`,
  }
}

export function smsBodyFor(lang: Lang, tenant: Tenant, branch: Branch | undefined, token: string): string {
  return smsBody(tenant, branch, token)[lang]
}

/** "5XX 00 00 XX" style grouping of up to 9 digits. */
export function formatPhoneDigits(digits: string): string {
  const d = digits.replace(/\D/g, '').slice(0, 9)
  return [d.slice(0, 3), d.slice(3, 5), d.slice(5, 7), d.slice(7, 9)].filter(Boolean).join(' ')
}

/** "+995 5•• ••• 0XY" from a full national number. */
export function maskPhone(digits: string): string {
  return `+995 5•• ••• ${digits.slice(-3)}`
}
