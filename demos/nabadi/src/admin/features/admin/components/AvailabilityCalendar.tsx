import { useMemo, useState } from 'react';
import { DayPicker } from 'react-day-picker';
import 'react-day-picker/dist/style.css';
import { useTranslation } from 'react-i18next';
import { ka, enUS } from 'date-fns/locale';
import { useAdminAvailabilitySummary } from '@/features/admin/hooks';
import { cn } from '@/lib/cn';
import { tbilisiTodayAsLocalDate } from '@/lib/datetime';

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

export function AvailabilityCalendar({ barberId, serviceId, selected, onSelect }: Props) {
  const { t, i18n } = useTranslation('admin');
  const [month, setMonth] = useState<Date>(selected ?? new Date());
  const locale = i18n.language?.startsWith('ka') ? ka : enUS;

  // Fetch a 31-day window covering the current visible month.
  const start = new Date(month.getFullYear(), month.getMonth(), 1);
  const end = new Date(month.getFullYear(), month.getMonth() + 1, 0);
  const summary = useAdminAvailabilitySummary(barberId, serviceId, ymd(start), ymd(end));

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

  // The "no booking in the past" boundary is the SHOP's today (Tbilisi).
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

      {barberId && serviceId ? (
        <Legend
          unavailableLabel={t('walk_in_page.legend_unavailable')}
          partialLabel={t('walk_in_page.legend_partial')}
          availableLabel={t('walk_in_page.legend_available')}
        />
      ) : (
        <p className="text-sm text-ink-muted">{t('walk_in_page.select_first')}</p>
      )}
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
      {/* Same --color-warn token as the calendar's partial-day dot. */}
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
