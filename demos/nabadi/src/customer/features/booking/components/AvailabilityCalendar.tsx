import { useMemo, useState } from 'react';
import { DayPicker } from 'react-day-picker';
import 'react-day-picker/dist/style.css';
import { useTranslation } from 'react-i18next';
import { ka, enUS } from 'date-fns/locale';
import { useAvailabilitySummary } from '@/features/booking/hooks';
import { SectionError } from '@/components/SectionError';
import { tbilisiTodayAsLocalDate } from '@/lib/datetime';
import { cn } from '@/lib/cn';

function ymd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

interface Props {
  barberId: number | null;
  serviceId: number | null;
  selected: Date | undefined;
  onSelect: (d: Date | undefined) => void;
}

/**
 * Per-day calendar coloured by barber + service availability.
 *
 * - Red diagonal stripe = barber has no free time at all that day
 * - Yellow dot         = barber has free time but not enough for this service
 * - Default            = available for the selected service
 *
 * Mirrors the admin Manual Booking calendar; surfaces here so customers
 * can't waste time clicking dead days.
 */
export function AvailabilityCalendar({ barberId, serviceId, selected, onSelect }: Props) {
  const { t, i18n } = useTranslation('book');
  const locale = i18n.language?.startsWith('ka') ? ka : enUS;
  const [month, setMonth] = useState<Date>(selected ?? new Date());

  // Fetch a window covering the visible month.
  const start = new Date(month.getFullYear(), month.getMonth(), 1);
  const end = new Date(month.getFullYear(), month.getMonth() + 1, 0);
  const summary = useAvailabilitySummary(barberId, serviceId, ymd(start), ymd(end));

  const { unavailable, partial } = useMemo(() => {
    const u: Date[] = [];
    const p: Date[] = [];
    for (const day of summary.data?.days ?? []) {
      const d = new Date(day.date + 'T12:00:00');
      if (!day.has_any_slot) u.push(d);
      else if (!day.has_service_slot) p.push(d);
    }
    return { unavailable: u, partial: p };
  }, [summary.data]);

  // Min-selectable day follows the shop's calendar, not the visitor's:
  // a client ahead of Tbilisi must not see Tbilisi's today disabled.
  const today = tbilisiTodayAsLocalDate();

  return (
    <div className="flex flex-col gap-3">
      <div className="rdp-wrap">
        <DayPicker
          mode="single"
          selected={selected}
          onSelect={onSelect}
          month={month}
          onMonthChange={setMonth}
          showOutsideDays
          weekStartsOn={1}
          locale={locale}
          disabled={[{ before: today }, ...unavailable]}
          modifiers={{ partial, unavailable }}
          modifiersClassNames={{
            partial: 'rdp-partial',
            unavailable: 'rdp-unavailable',
            selected: 'rdp-selected',
            today: 'rdp-today',
          }}
        />
      </div>

      {/* A failed summary otherwise renders every day as available — say so. */}
      {summary.isError ? (
        <SectionError error={summary.error} onRetry={() => summary.refetch()} />
      ) : barberId && serviceId ? (
        <Legend
          unavailableLabel={t('legend_unavailable')}
          partialLabel={t('legend_partial')}
          availableLabel={t('legend_available')}
        />
      ) : null}
    </div>
  );
}

function Legend({
  unavailableLabel,
  partialLabel,
  availableLabel,
}: {
  unavailableLabel: string;
  partialLabel: string;
  availableLabel: string;
}) {
  return (
    <div className="flex flex-wrap gap-3 text-xs text-ink-muted">
      <LegendItem dotClass="bg-success" label={availableLabel} />
      <LegendItem dotClass="bg-warn" label={partialLabel} />
      <LegendItem dotClass="bg-danger" label={unavailableLabel} />
    </div>
  );
}

function LegendItem({ dotClass, label }: { dotClass: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={cn('w-2 h-2 rounded-pill', dotClass)} aria-hidden />
      {label}
    </span>
  );
}
