/**
 * Pure positioning math for the custom bookings day-calendar (spec §9.2).
 *
 * Deliberate deviation from the spec's "FullCalendar": its multi-resource
 * lane view (one column per barber) requires a paid Premium license, so the
 * lanes are custom-built. All math lives here — timezone conversion, axis
 * range, block geometry — so it stays unit-testable without the DOM.
 *
 * Everything is expressed in "minutes since Tbilisi midnight" for the day
 * being rendered: bookings come as UTC instants, shop hours as naive local
 * times, and the shop's wall clock (Asia/Tbilisi) is the one source of truth.
 */

import { TBILISI_TZ } from '@/lib/datetime';

export interface DayAxis {
  /** Minutes since Tbilisi midnight where the time axis starts. */
  startMin: number;
  /** Minutes since Tbilisi midnight where the time axis ends. */
  endMin: number;
}

/** Vertical scale of the lanes: one minute of booking = this many pixels. */
export const PX_PER_MIN = 1.4;

/** Gridline step + outward snap for the axis boundaries. */
export const GRID_STEP_MIN = 30;

/**
 * Fallback axis (09:00–21:00) for a weekday with no shop-hours row — a
 * CLOSED day is expressed as the absence of a row.
 */
export const DEFAULT_AXIS: DayAxis = { startMin: 9 * 60, endMin: 21 * 60 };

/** Shortest rendered block, px — a 10-minute booking must stay clickable. */
export const MIN_BLOCK_PX = 22;

/** 'HH:MM' or 'HH:MM:SS' → minutes since midnight. */
export function parseHm(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + (m || 0);
}

/** Minutes since Tbilisi midnight for a UTC/ISO instant. */
export function tbilisiMinutesOfDay(iso: string): number {
  const formatted = new Intl.DateTimeFormat('en-GB', {
    timeZone: TBILISI_TZ,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(new Date(iso));
  return parseHm(formatted);
}

/** Weekday of a 'YYYY-MM-DD': 0=Monday … 6=Sunday (backend WEEKDAY_CHOICES). */
export function weekdayMondayIdx(ymd: string): number {
  const [y, m, d] = ymd.split('-').map(Number);
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay(); // 0=Sun … 6=Sat
  return (dow + 6) % 7;
}

export interface AxisSource {
  start_time: string;
  end_time: string;
}

export interface BookingWindow {
  start_at: string;
  end_at: string;
}

/**
 * Booking window in Tbilisi minutes. A window that crosses midnight (end
 * wall-clock ≤ start) is clamped to the end of the rendered day.
 */
export function bookingMinutes(b: BookingWindow): { start: number; end: number } {
  const start = tbilisiMinutesOfDay(b.start_at);
  let end = tbilisiMinutesOfDay(b.end_at);
  if (end <= start) end = 24 * 60;
  return { start, end };
}

/**
 * Time-axis range for one day: the shop's open hours when known, expanded to
 * cover any booking that spills outside them (e.g. an admin-forced late slot),
 * snapped outward to the gridline step so lines stay aligned. `shopRow=null`
 * (closed day / hours unreadable) falls back to DEFAULT_AXIS.
 */
export function computeDayAxis(shopRow: AxisSource | null, bookings: BookingWindow[]): DayAxis {
  let startMin = shopRow ? parseHm(shopRow.start_time) : DEFAULT_AXIS.startMin;
  let endMin = shopRow ? parseHm(shopRow.end_time) : DEFAULT_AXIS.endMin;
  for (const b of bookings) {
    const w = bookingMinutes(b);
    startMin = Math.min(startMin, w.start);
    endMin = Math.max(endMin, w.end);
  }
  startMin = Math.max(0, Math.floor(startMin / GRID_STEP_MIN) * GRID_STEP_MIN);
  endMin = Math.min(24 * 60, Math.ceil(endMin / GRID_STEP_MIN) * GRID_STEP_MIN);
  if (endMin <= startMin) return { ...DEFAULT_AXIS };
  return { startMin, endMin };
}

export interface BlockRect {
  top: number;
  height: number;
}

/**
 * Pixel geometry of one booking block inside a lane whose top edge is
 * `axis.startMin`. Clamped into the axis; never shorter than MIN_BLOCK_PX.
 */
export function blockRect(
  b: BookingWindow,
  axis: DayAxis,
  pxPerMin: number = PX_PER_MIN,
): BlockRect {
  const w = bookingMinutes(b);
  const start = Math.max(w.start, axis.startMin);
  const end = Math.min(Math.max(w.end, start), axis.endMin);
  return {
    top: (start - axis.startMin) * pxPerMin,
    height: Math.max((end - start) * pxPerMin, MIN_BLOCK_PX),
  };
}

/** Total lane height for an axis, px. */
export function axisHeight(axis: DayAxis, pxPerMin: number = PX_PER_MIN): number {
  return (axis.endMin - axis.startMin) * pxPerMin;
}

/**
 * All step-aligned minute marks within the axis (boundaries included when
 * aligned). The component draws interior marks as gridlines and hour-aligned
 * marks as axis labels.
 */
export function gridMarks(axis: DayAxis, step: number = GRID_STEP_MIN): number[] {
  const marks: number[] = [];
  const first = Math.ceil(axis.startMin / step) * step;
  for (let m = first; m <= axis.endMin; m += step) marks.push(m);
  return marks;
}

/** Minutes since midnight → 'HH:MM' label. */
export function fmtMinutes(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}
