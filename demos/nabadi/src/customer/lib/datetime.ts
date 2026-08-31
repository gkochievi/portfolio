/**
 * Shared date/time/money formatting.
 *
 * All booking-domain timestamps are instants; the shop lives in Tbilisi, so
 * every slot/booking time must render as Asia/Tbilisi WALL TIME regardless of
 * the visitor's device timezone (spec §7/§8). Never call
 * toLocaleTimeString/getHours directly on booking datetimes — use these.
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

/**
 * Tbilisi's "today" as a client-local midnight Date — the shape
 * react-day-picker needs for its `disabled: { before }` boundary.
 */
export function tbilisiTodayAsLocalDate(): Date {
  const [y, m, d] = todayTbilisiYmd().split('-').map(Number);
  return new Date(y, m - 1, d);
}

/** Hour of day (0–23) of the instant, in Tbilisi. Used to group slots. */
export function tbilisiHour(iso: string): number {
  return Number(
    new Intl.DateTimeFormat('en-GB', {
      timeZone: TBILISI_TZ,
      hour: 'numeric',
      hourCycle: 'h23',
    }).format(new Date(iso)),
  );
}

/** 'HH:MM' wall time in Tbilisi. 24h clock — the Georgian convention. */
export function formatTbilisiTime(iso: string, locale = 'ka'): string {
  return new Intl.DateTimeFormat(locale, {
    timeZone: TBILISI_TZ,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(new Date(iso));
}

/** Locale-aware date rendered in Tbilisi calendar space. */
export function formatTbilisiDate(
  iso: string,
  locale = 'ka',
  options?: Intl.DateTimeFormatOptions,
): string {
  return new Intl.DateTimeFormat(locale, {
    timeZone: TBILISI_TZ,
    ...(options ?? { year: 'numeric', month: '2-digit', day: '2-digit' }),
  }).format(new Date(iso));
}

/**
 * Prices in GEL, locale-aware: '40 ₾' style for KA, 'GEL 40' style for EN.
 * Accepts the API's decimal strings ('40.00').
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
