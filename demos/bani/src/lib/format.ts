/**
 * Tenant-time formatting. All times display in the tenant's zone (Asia/Tbilisi,
 * UTC+4 all year), whatever the visitor's own zone is, so seeded business hours
 * read as business hours for everyone.
 */
import type { ISODate, ISODateTime, Lang } from '@/types'

export const TENANT_TZ = 'Asia/Tbilisi'
/** Tbilisi has no DST, so the offset is a constant. */
export const TENANT_OFFSET_MIN = 240

const MINUTE = 60_000
const locale = (lang: Lang): string => (lang === 'ka' ? 'ka-GE' : 'en-GB')
const pad = (n: number, width = 2): string => String(n).padStart(width, '0')

function toDate(value: ISODateTime | Date | number): Date {
  return value instanceof Date ? value : new Date(value)
}

/** The tenant wall-clock parts of an instant. */
function tenantParts(value: ISODateTime | Date | number) {
  const shifted = new Date(toDate(value).getTime() + TENANT_OFFSET_MIN * MINUTE)
  return {
    y: shifted.getUTCFullYear(),
    m: shifted.getUTCMonth() + 1,
    d: shifted.getUTCDate(),
    hh: shifted.getUTCHours(),
    mm: shifted.getUTCMinutes(),
    ss: shifted.getUTCSeconds(),
  }
}

export function fmtDateTime(iso: ISODateTime | null | undefined, lang: Lang = 'en', opts: { seconds?: boolean } = {}): string {
  if (!iso) return '-'
  return new Intl.DateTimeFormat(locale(lang), {
    timeZone: TENANT_TZ,
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: opts.seconds ? '2-digit' : undefined,
    hour12: false,
  }).format(toDate(iso))
}

export function fmtDate(iso: ISODateTime | ISODate | null | undefined, lang: Lang = 'en'): string {
  if (!iso) return '-'
  const value = /^\d{4}-\d{2}-\d{2}$/.test(iso) ? `${iso}T12:00:00+04:00` : iso
  return new Intl.DateTimeFormat(locale(lang), { timeZone: TENANT_TZ, year: 'numeric', month: 'short', day: '2-digit' }).format(
    toDate(value),
  )
}

export function fmtTime(iso: ISODateTime | null | undefined, _lang: Lang = 'en', opts: { seconds?: boolean } = {}): string {
  if (!iso) return '-'
  const p = tenantParts(iso)
  return opts.seconds ? `${pad(p.hh)}:${pad(p.mm)}:${pad(p.ss)}` : `${pad(p.hh)}:${pad(p.mm)}`
}

/** 75 → '1:15'; 3725 → '1:02:05'. */
export function fmtDuration(sec: number | null | undefined): string {
  if (sec == null || !Number.isFinite(sec)) return '-'
  const total = Math.max(0, Math.round(sec))
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`
}

/** 273_120 → '3d 3h 52m' / '3დ 3სთ 52წთ'. */
export function fmtUptime(sec: number | null | undefined, lang: Lang = 'en'): string {
  if (sec == null || !Number.isFinite(sec)) return '-'
  const d = Math.floor(sec / 86400)
  const h = Math.floor((sec % 86400) / 3600)
  const m = Math.floor((sec % 3600) / 60)
  const u = lang === 'ka' ? { d: 'დ', h: 'სთ', m: 'წთ' } : { d: 'd', h: 'h', m: 'm' }
  return `${d}${u.d} ${h}${u.h} ${m}${u.m}`
}

export function fmtNumber(n: number | null | undefined, lang: Lang = 'en', maxFractionDigits = 0): string {
  if (n == null || !Number.isFinite(n)) return '-'
  return new Intl.NumberFormat(locale(lang), { maximumFractionDigits: maxFractionDigits }).format(n)
}

export function fmtPct(n: number | null | undefined, digits = 0): string {
  if (n == null || !Number.isFinite(n)) return '-'
  return `${n.toFixed(digits)}%`
}

/** 1536 → '1.5 KB'. Binary units, one decimal from KB up. */
export function fmtBytes(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return '-'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  let value = Math.abs(n)
  let unit = 0
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024
    unit += 1
  }
  return `${n < 0 ? '-' : ''}${unit === 0 ? value : value.toFixed(1)} ${units[unit]}`
}

export function timeAgo(iso: ISODateTime | null | undefined, lang: Lang = 'en', now: number = Date.now()): string {
  if (!iso) return '-'
  const diffSec = Math.round((toDate(iso).getTime() - now) / 1000)
  const rtf = new Intl.RelativeTimeFormat(locale(lang), { numeric: 'auto' })
  const abs = Math.abs(diffSec)
  if (abs < 45) return rtf.format(diffSec, 'second')
  if (abs < 45 * 60) return rtf.format(Math.round(diffSec / 60), 'minute')
  if (abs < 22 * 3600) return rtf.format(Math.round(diffSec / 3600), 'hour')
  return rtf.format(Math.round(diffSec / 86400), 'day')
}

/** The tenant calendar day of an instant, 'YYYY-MM-DD'. */
export function tenantDate(value: ISODateTime | Date | number = Date.now()): ISODate {
  const p = tenantParts(value)
  return `${p.y}-${pad(p.m)}-${pad(p.d)}`
}

/** 00:00:00.000 to 23:59:59.999 of the tenant day containing `value`, as ISO instants. */
export function tenantDayRange(value: ISODateTime | Date | number = Date.now()): { from: ISODateTime; to: ISODateTime } {
  const day = tenantDate(value)
  return {
    from: new Date(`${day}T00:00:00.000+04:00`).toISOString(),
    to: new Date(`${day}T23:59:59.999+04:00`).toISOString(),
  }
}

/** ISO instant → value for <input type="datetime-local"> (or type="date" when withTime is false), in tenant time. */
export function toTenantInput(iso: ISODateTime, withTime = true): string {
  const p = tenantParts(iso)
  const date = `${p.y}-${pad(p.m)}-${pad(p.d)}`
  return withTime ? `${date}T${pad(p.hh)}:${pad(p.mm)}` : date
}

/** <input type="datetime-local"> / type="date" value read as tenant time → ISO instant. */
export function fromTenantInput(value: string): ISODateTime {
  const withTime = value.includes('T') ? value : `${value}T00:00`
  const normalised = withTime.length === 16 ? `${withTime}:00` : withTime
  return new Date(`${normalised}+04:00`).toISOString()
}
