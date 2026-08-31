/**
 * Shared date/money helpers for the admin panel.
 *
 * The shop lives in Tbilisi: "today" for the dashboard, quick filters, and
 * default ranges must be the Tbilisi calendar date, not the UTC date —
 * between 00:00 and 04:00 local, `new Date().toISOString()` still says
 * yesterday. Ported from the customer app's `lib/datetime.ts` (spec §7/§8);
 * kept as a local copy because the apps don't share a package.
 */

export const TBILISI_TZ = 'Asia/Tbilisi';

/** 'YYYY-MM-DD' of the given instant, in Tbilisi. */
export function tbilisiYmd(d: Date): string {
  // en-CA reliably formats as YYYY-MM-DD.
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: TBILISI_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);
}

/** Today's calendar date in Tbilisi as 'YYYY-MM-DD'. */
export function todayTbilisiYmd(): string {
  return tbilisiYmd(new Date());
}

/** Tbilisi calendar date `days` from now (negative = past) as 'YYYY-MM-DD'. */
export function tbilisiYmdOffset(days: number): string {
  return tbilisiYmd(new Date(Date.now() + days * 86_400_000));
}

/** Pure calendar arithmetic on a 'YYYY-MM-DD' string (UTC-based, DST-proof). */
export function addDaysYmd(ymd: string, days: number): string {
  const [y, m, d] = ymd.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

/** Monday of the ISO week containing the given 'YYYY-MM-DD'. */
export function mondayOfYmd(ymd: string): string {
  const [y, m, d] = ymd.split('-').map(Number);
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay(); // 0=Sun … 6=Sat
  return addDaysYmd(ymd, dow === 0 ? -6 : 1 - dow);
}

/**
 * Tbilisi's "today" as a client-local midnight Date — the shape
 * react-day-picker needs for its `disabled: { before }` boundary.
 */
export function tbilisiTodayAsLocalDate(): Date {
  const [y, m, d] = todayTbilisiYmd().split('-').map(Number);
  return new Date(y, m - 1, d);
}

/**
 * Booking-domain instants render as Tbilisi WALL TIME everywhere, exactly as
 * in the customer app (spec §7/§8) and this console's own calendar. Never call
 * toLocaleTimeString/toLocaleDateString directly on a domain timestamp — for a
 * visitor outside +04:00 the list would disagree with the calendar beside it.
 */
export function formatTbilisiTime(value: string | Date, locale?: string): string {
  return new Intl.DateTimeFormat(locale, {
    timeZone: TBILISI_TZ,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(typeof value === 'string' ? new Date(value) : value);
}

/** Locale-aware date rendered in Tbilisi calendar space. */
export function formatTbilisiDate(
  value: string | Date,
  locale?: string,
  options?: Intl.DateTimeFormatOptions,
): string {
  return new Intl.DateTimeFormat(locale, {
    timeZone: TBILISI_TZ,
    ...(options ?? { year: 'numeric', month: '2-digit', day: '2-digit' }),
  }).format(typeof value === 'string' ? new Date(value) : value);
}

/** Date + time, Tbilisi wall clock. */
export function formatTbilisiDateTime(value: string | Date, locale?: string): string {
  return `${formatTbilisiDate(value, locale)} ${formatTbilisiTime(value, locale)}`;
}

/**
 * Prices in GEL, locale-aware: '40 ₾' style for KA, 'GEL 40' style for EN
 * (brand convention: the ₾ symbol is KA-only). Accepts the API's decimal
 * strings ('40.00').
 */
export function formatMoney(amount: string | number, locale = 'ka'): string {
  const n = typeof amount === 'string' ? Number(amount) : amount;
  if (!Number.isFinite(n)) return String(amount);
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: 'GEL',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(n);
}
