import { useTranslation } from 'react-i18next';
import { Trash2 } from 'lucide-react';
import { Button } from '@/components/Button';
import { cn } from '@/lib/cn';
import { formatTbilisiDate, formatTbilisiTime, tbilisiYmd } from '@/lib/datetime';
import { detectKind } from '../time-off-utils';
import type { AdminTimeOff } from '../crud-hooks';

/**
 * Shared time-off row — used by the global /time-off page and the
 * barber-detail "Time off" tab (extracted rather than duplicated).
 * Non-component helpers live in ../time-off-utils (react-refresh rule).
 */
export function TimeOffRow({
  item,
  barberLabel,
  onDelete,
  deleting,
}: {
  item: AdminTimeOff;
  barberLabel: (id: number | null) => string;
  onDelete: () => void;
  deleting: boolean;
}) {
  const { t } = useTranslation('admin');
  const kind = detectKind(item);
  const s = new Date(item.start_datetime);
  const e = new Date(item.end_datetime);
  // Same-day and all rendering in the shop's zone, like the calendar beside it.
  const sameDay = tbilisiYmd(s) === tbilisiYmd(e);

  const dateLabel = sameDay
    ? kind === 'day_off'
      ? formatTbilisiDate(s)
      : `${formatTbilisiDate(s)} ${formatTbilisiTime(s)} – ${formatTbilisiTime(e)}`
    : `${formatTbilisiDate(s)} – ${formatTbilisiDate(e)}`;

  return (
    <div className="flex items-center gap-3 px-4 py-3 border-b border-line last:border-b-0 bg-surface hover:bg-bg/40 transition">
      <span
        className={cn(
          'inline-flex items-center px-2.5 py-1 rounded-pill text-[10px] uppercase tracking-[0.12em] font-medium shrink-0',
          kind === 'day_off' && 'bg-accent-soft text-ink',
          kind === 'vacation' && 'bg-ink text-bg',
          kind === 'custom' && 'bg-line/60 text-ink-muted',
        )}
      >
        {t(`time_off.kind_${kind}`)}
      </span>
      <div className="flex-1 min-w-0">
        <div className="text-ink text-sm tabular-nums">{dateLabel}</div>
        <div className="flex items-center gap-2 mt-0.5">
          <span
            className={cn(
              'text-xs',
              item.barber === null ? 'text-accent font-medium' : 'text-ink-muted',
            )}
          >
            {barberLabel(item.barber)}
          </span>
          {item.reason && <span className="text-xs text-ink-muted">· {item.reason}</span>}
        </div>
      </div>
      <Button
        variant="ghost"
        size="sm"
        onClick={onDelete}
        loading={deleting}
        className="rounded-pill text-ink-muted hover:text-danger"
        aria-label={t('actions.delete')}
      >
        <Trash2 className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}
