import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CalendarOff, Plus } from 'lucide-react';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Chip } from '@/components/Chip';
import { EmptyState } from '@/components/EmptyState';
import { ErrorMessage } from '@/components/ErrorMessage';
import { Input } from '@/components/Input';
import { SectionError } from '@/components/SectionError';
import { ConfirmDialog } from './ConfirmDialog';
import { TimeOffRow } from './TimeOffShared';
import { localISO, type TimeOffKind } from '../time-off-utils';
import {
  useAdminCreateTimeOff,
  useAdminDeleteTimeOff,
  useAdminTimeOff,
  type AdminTimeOff,
} from '../crud-hooks';

/**
 * "Time off" tab on the barber detail page (spec §9.4). Same hooks and row
 * component as the global /time-off page, pinned to one barber — shop-wide
 * blocks are shown too since they also close this barber's book.
 */
export function BarberTimeOffTab({
  barberId,
  barberName,
}: {
  barberId: number;
  barberName: string;
}) {
  const { t } = useTranslation('admin');
  const timeOff = useAdminTimeOff(barberId);
  const items = useMemo(() => timeOff.data ?? [], [timeOff.data]);
  const create = useAdminCreateTimeOff();
  const del = useAdminDeleteTimeOff();

  const [kind, setKind] = useState<TimeOffKind>('day_off');
  const [day, setDay] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [reason, setReason] = useState('');
  const [deleting, setDeleting] = useState<AdminTimeOff | null>(null);

  const sorted = useMemo(
    () =>
      [...items].sort(
        (a, b) => new Date(b.start_datetime).getTime() - new Date(a.start_datetime).getTime(),
      ),
    [items],
  );

  const reset = () => {
    setDay('');
    setFrom('');
    setTo('');
    setStart('');
    setEnd('');
    setReason('');
  };

  const onAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    let start_datetime: string;
    let end_datetime: string;
    if (kind === 'day_off') {
      if (!day) return;
      start_datetime = localISO(day, '00:00');
      end_datetime = localISO(day, '23:59');
    } else if (kind === 'vacation') {
      if (!from || !to) return;
      start_datetime = localISO(from, '00:00');
      end_datetime = localISO(to, '23:59');
    } else {
      if (!start || !end) return;
      start_datetime = new Date(start).toISOString();
      end_datetime = new Date(end).toISOString();
    }
    try {
      await create.mutateAsync({ barber: barberId, start_datetime, end_datetime, reason });
      reset();
    } catch {
      /* surfaced via toast + inline error */
    }
  };

  const onConfirmDelete = async () => {
    if (!deleting || del.isPending) return;
    try {
      await del.mutateAsync(deleting.id);
      setDeleting(null);
    } catch {
      /* surfaced via toast + inline error */
    }
  };

  const barberLabel = (id: number | null) =>
    id === null ? t('barbers_page.shop_wide') : barberName;

  if (timeOff.isError) {
    return <SectionError error={timeOff.error} onRetry={() => timeOff.refetch()} />;
  }

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <h2 className="font-display text-xl mb-4 tracking-tight">{t('time_off.add_title')}</h2>
        <div className="flex flex-wrap gap-2 mb-4">
          {(['day_off', 'vacation', 'custom'] as TimeOffKind[]).map((k) => (
            <Chip
              key={k}
              active={kind === k}
              onClick={() => {
                setKind(k);
                reset();
              }}
            >
              {t(`time_off.kind_${k}`)}
            </Chip>
          ))}
        </div>

        <form onSubmit={onAdd} className="flex flex-col gap-3">
          {kind === 'day_off' && (
            <Input
              label={t('time_off.f_date')}
              type="date"
              value={day}
              onChange={(e) => setDay(e.target.value)}
              required
            />
          )}
          {kind === 'vacation' && (
            <div className="grid grid-cols-2 gap-3">
              <Input
                label={t('time_off.f_from_date')}
                type="date"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                required
              />
              <Input
                label={t('time_off.f_to_date')}
                type="date"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                required
              />
            </div>
          )}
          {kind === 'custom' && (
            <div className="grid grid-cols-2 gap-3">
              <Input
                label={t('time_off.f_from')}
                type="datetime-local"
                value={start}
                onChange={(e) => setStart(e.target.value)}
                required
              />
              <Input
                label={t('time_off.f_to')}
                type="datetime-local"
                value={end}
                onChange={(e) => setEnd(e.target.value)}
                required
              />
            </div>
          )}
          <Input
            label={t('barbers_page.reason_optional')}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
          <ErrorMessage error={create.error} />
          <Button
            type="submit"
            variant="accent"
            loading={create.isPending}
            className="self-start rounded-pill"
          >
            <Plus className="h-4 w-4" />
            {t('actions.add')}
          </Button>
        </form>
      </Card>

      {timeOff.isLoading ? (
        <Card>
          <p role="status" aria-live="polite" className="text-ink-muted text-sm">
            {t('actions.loading')}
          </p>
        </Card>
      ) : sorted.length === 0 ? (
        <EmptyState
          icon={<CalendarOff className="h-5 w-5" />}
          title={t('barbers_page.no_time_off')}
          hint={t('time_off.empty_hint')}
        />
      ) : (
        <Card>
          <div className="border border-line rounded-md overflow-hidden">
            {sorted.map((item) => (
              <TimeOffRow
                key={item.id}
                item={item}
                barberLabel={barberLabel}
                onDelete={() => setDeleting(item)}
                deleting={del.isPending && del.variables === item.id}
              />
            ))}
          </div>
          <ErrorMessage error={del.error} />
        </Card>
      )}

      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(o) => !o && !del.isPending && setDeleting(null)}
        title={t('time_off.delete_title')}
        body={t('time_off.delete_body')}
        confirmLabel={t('actions.confirm_delete')}
        cancelLabel={t('actions.cancel')}
        destructive
        loading={del.isPending}
        onConfirm={onConfirmDelete}
      />
    </div>
  );
}
