import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { CalendarOff, Plus } from 'lucide-react';
import { Badge } from '@/components/Badge';
import { cn } from '@/lib/cn';
import { pickLocalized } from '@/lib/localized';
import {
  PX_PER_MIN,
  axisHeight,
  blockRect,
  computeDayAxis,
  fmtMinutes,
  gridMarks,
  tbilisiMinutesOfDay,
  type DayAxis,
} from '../calendar-utils';
import type { AdminBarberSummary, AdminBooking } from '../hooks';

/**
 * Custom day calendar: time axis × one lane per active barber (spec §9.2).
 * Deliberate deviation: the spec names FullCalendar, but its multi-resource
 * lane view needs a paid license — this is a brand-styled custom build.
 * All geometry comes from calendar-utils (unit-tested there).
 */

const STATUS_BADGES: Record<
  AdminBooking['status'],
  'accent' | 'ink' | 'success' | 'danger' | 'default'
> = {
  pending: 'accent',
  confirmed: 'ink',
  completed: 'success',
  cancelled: 'danger',
  no_show: 'default',
};

/** Block fill + 1px border per status — brand tokens only, no gradients. */
const BLOCK_STYLES: Record<AdminBooking['status'], string> = {
  pending: 'bg-accent-soft/50 border-accent',
  confirmed: 'bg-surface-2 border-ink/50',
  completed: 'bg-success/10 border-success/50',
  cancelled: 'bg-danger/10 border-danger/50',
  no_show: 'bg-bg border-line-strong',
};

interface ShopRow {
  start_time: string;
  end_time: string;
}

interface Props {
  /** Bookings of the rendered day (cancelled ones excluded by the caller). */
  bookings: AdminBooking[];
  /** Active barbers — one lane each, in display order. */
  barbers: AdminBarberSummary[];
  /**
   * Shop-hours row for this weekday, or `null` when the shop is closed — a
   * CLOSED day is expressed as no row at all, so the axis falls back to the
   * defaults and the calendar carries a "closed" note.
   */
  shopRow: ShopRow | null;
  onBookingClick: (id: number) => void;
  /** Builds the walk-in prefill link for a lane; null hides the affordance. */
  walkInHref: ((barberId: number) => string) | null;
}

export function BookingsCalendar({
  bookings,
  barbers,
  shopRow,
  onBookingClick,
  walkInHref,
}: Props) {
  const { t } = useTranslation('admin');

  const axis = useMemo(() => computeDayAxis(shopRow, bookings), [shopRow, bookings]);
  const marks = useMemo(() => gridMarks(axis), [axis]);
  const laneHeight = axisHeight(axis);

  const byBarber = useMemo(() => {
    const map = new Map<number, AdminBooking[]>();
    for (const b of bookings) {
      map.set(b.barber, [...(map.get(b.barber) ?? []), b]);
    }
    return map;
  }, [bookings]);

  if (barbers.length === 0) {
    return (
      <div className="border border-line rounded-2xl bg-surface p-10 text-center">
        <p className="text-sm text-ink-muted">{t('bookings.cal_no_barbers')}</p>
      </div>
    );
  }

  return (
    <div className="border border-line rounded-2xl bg-surface overflow-hidden">
      {shopRow === null && (
        <p className="flex items-center gap-2 px-4 py-2.5 border-b border-line text-xs text-ink-muted">
          <CalendarOff className="h-3.5 w-3.5 shrink-0" aria-hidden />
          {t('bookings.cal_closed_note')}
        </p>
      )}
      {bookings.length === 0 && (
        <p className="px-4 py-2.5 border-b border-line text-xs text-ink-muted">
          {t('bookings.cal_empty')}
        </p>
      )}

      <div className="overflow-auto max-h-[72vh]">
        <div
          className="grid"
          style={{
            gridTemplateColumns: `3.5rem repeat(${barbers.length}, minmax(180px, 1fr))`,
            gridTemplateRows: `auto ${laneHeight}px`,
          }}
        >
          {/* Header row: sticky corner + one sticky cell per barber */}
          <div className="sticky top-0 left-0 z-30 bg-surface border-b border-r border-line" />
          {barbers.map((b, i) => (
            <LaneHeader
              key={b.id}
              barber={b}
              withLeftBorder={i > 0}
              walkInHref={walkInHref ? walkInHref(b.id) : null}
            />
          ))}

          {/* Time axis column — sticky left; position:sticky is itself the
              containing block for the absolutely-positioned hour labels */}
          <div
            className="sticky left-0 z-10 bg-surface border-r border-line"
            style={{ height: laneHeight }}
            aria-hidden
          >
            {marks
              .filter((m) => m % 60 === 0 && m < axis.endMin)
              .map((m) => (
                <span
                  key={m}
                  className="absolute right-1.5 text-[10px] text-ink-muted tabular-nums"
                  style={{ top: Math.max((m - axis.startMin) * PX_PER_MIN - 7, 1) }}
                >
                  {fmtMinutes(m)}
                </span>
              ))}
          </div>

          {/* One lane per barber */}
          {barbers.map((b, i) => (
            <div
              key={b.id}
              className={cn('relative', i > 0 && 'border-l border-line')}
              style={{ height: laneHeight }}
            >
              {/* 30-min gridlines; hour lines are stronger */}
              {marks
                .filter((m) => m > axis.startMin && m < axis.endMin)
                .map((m) => (
                  <div
                    key={m}
                    aria-hidden
                    className={cn(
                      'absolute inset-x-0 border-t',
                      m % 60 === 0 ? 'border-line-strong' : 'border-line',
                    )}
                    style={{ top: (m - axis.startMin) * PX_PER_MIN }}
                  />
                ))}

              {(byBarber.get(b.id) ?? []).map((booking) => (
                <BookingBlock
                  key={booking.id}
                  booking={booking}
                  axis={axis}
                  onClick={() => onBookingClick(booking.id)}
                />
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function LaneHeader({
  barber,
  withLeftBorder,
  walkInHref,
}: {
  barber: AdminBarberSummary;
  withLeftBorder: boolean;
  walkInHref: string | null;
}) {
  const { t } = useTranslation('admin');
  const name = `${barber.user_first_name} ${barber.user_last_name}`.trim();
  return (
    <div
      className={cn(
        'sticky top-0 z-20 bg-surface border-b border-line px-3 py-2 flex items-center gap-2 min-w-0',
        withLeftBorder && 'border-l',
      )}
    >
      {barber.photo ? (
        <img src={barber.photo} alt="" className="w-8 h-8 rounded-pill object-cover shrink-0" />
      ) : (
        <span
          aria-hidden
          className="inline-flex items-center justify-center w-8 h-8 rounded-pill bg-ink text-bg text-xs font-medium shrink-0"
        >
          {name[0]?.toUpperCase() ?? '?'}
        </span>
      )}
      <span className="text-sm font-medium text-ink truncate">{name}</span>
      {walkInHref && (
        <Link
          to={walkInHref}
          aria-label={t('bookings.cal_add_booking_for', { name })}
          className="ml-auto inline-flex items-center justify-center w-7 h-7 rounded-pill text-ink-muted hover:text-ink hover:bg-line/50 transition shrink-0"
        >
          <Plus className="h-4 w-4" aria-hidden />
        </Link>
      )}
    </div>
  );
}

function BookingBlock({
  booking,
  axis,
  onClick,
}: {
  booking: AdminBooking;
  axis: DayAxis;
  onClick: () => void;
}) {
  const { t, i18n } = useTranslation('admin');
  const rect = blockRect(booking, axis);
  const name = (booking.customer ? booking.customer_name : booking.walk_in_name) || '—';
  const service = pickLocalized(booking.service_name, booking.service_name_en, i18n.language);
  const startLabel = fmtMinutes(tbilisiMinutesOfDay(booking.start_at));
  const endLabel = fmtMinutes(tbilisiMinutesOfDay(booking.end_at));
  // Tight blocks (short services) drop the second line; the badge needs
  // ~2 lines of room too.
  const roomy = rect.height >= 40;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={t('bookings.cal_block_label', { time: startLabel, name, service })}
      className={cn(
        'absolute inset-x-1 rounded-md border text-left px-2 py-0.5 overflow-hidden',
        'transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40',
        'hover:shadow-[var(--shadow-soft)]',
        BLOCK_STYLES[booking.status],
      )}
      style={{ top: rect.top, height: rect.height }}
    >
      <span className="flex items-center justify-between gap-1 min-w-0">
        <span className="text-xs font-medium text-ink truncate">{name}</span>
        {roomy && (
          <Badge
            variant={STATUS_BADGES[booking.status]}
            className="shrink-0 text-[9px] px-1.5 py-0"
          >
            {t(`status.${booking.status}`)}
          </Badge>
        )}
      </span>
      <span className="block text-[11px] text-ink-muted truncate tabular-nums">
        {startLabel}–{endLabel} · {service}
      </span>
    </button>
  );
}
