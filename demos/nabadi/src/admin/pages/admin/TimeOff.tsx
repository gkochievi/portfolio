import { useMemo, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { CalendarOff, Plus } from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Input } from '@/components/Input';
import { ErrorMessage } from '@/components/ErrorMessage';
import { EmptyState } from '@/components/EmptyState';
import { Pager } from '@/components/Pager';
import { SectionError } from '@/components/SectionError';
import { ConfirmDialog } from '@/features/admin/components/ConfirmDialog';
import { TimeOffRow } from '@/features/admin/components/TimeOffShared';
import { detectKind, localISO, type TimeOffKind as Kind } from '@/features/admin/time-off-utils';
import { PAGE_SIZE, pageCount, usePageState } from '@/lib/paginated';
import { useAdminBarbers } from '@/features/admin/hooks';
import {
  useAdminAllTimeOff,
  useAdminCreateTimeOff,
  useAdminDeleteTimeOff,
  type AdminTimeOff,
} from '@/features/admin/crud-hooks';
import { cn } from '@/lib/cn';

type ScopeQuick = 'all' | 'upcoming' | 'past';

export function AdminTimeOff() {
  const { t } = useTranslation('admin');
  const timeOff = useAdminAllTimeOff();
  const items = useMemo(() => timeOff.data ?? [], [timeOff.data]);
  const isLoading = timeOff.isLoading;
  const { data: barbers } = useAdminBarbers();
  const create = useAdminCreateTimeOff();
  const del = useAdminDeleteTimeOff();

  const [kind, setKind] = useState<Kind>('day_off');
  const [barberId, setBarberId] = useState<number | 'shop'>('shop');
  // Day off
  const [day, setDay] = useState('');
  // Vacation
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  // Custom
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [reason, setReason] = useState('');

  // Filters
  const [scope, setScope] = useState<ScopeQuick>('upcoming');
  const [filterBarber, setFilterBarber] = useState<number | 'all'>('all');
  const [filterKind, setFilterKind] = useState<Kind | 'all'>('all');

  // Snapshot "now" once per mount so filtering is stable across re-renders
  // (and so the lint purity rule doesn't fire on Date.now in useMemo).
  const [now] = useState<number>(() => Date.now());

  // Deleting reopens booking slots immediately — always confirm first.
  const [deleting, setDeleting] = useState<AdminTimeOff | null>(null);

  const onConfirmDelete = async () => {
    if (!deleting || del.isPending) return;
    try {
      await del.mutateAsync(deleting.id);
      setDeleting(null);
    } catch {
      /* surfaced via toast + inline error */
    }
  };

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
      await create.mutateAsync({
        barber: barberId === 'shop' ? null : barberId,
        start_datetime,
        end_datetime,
        reason,
      });
      reset();
    } catch {
      /* surfaced */
    }
  };

  const filtered = useMemo(() => {
    return items
      .filter((it) => {
        if (filterBarber !== 'all') {
          if (filterBarber === ('shop' as unknown as number)) {
            if (it.barber !== null) return false;
          } else if (it.barber !== filterBarber) return false;
        }
        if (filterKind !== 'all' && detectKind(it) !== filterKind) return false;
        if (scope === 'upcoming' && new Date(it.end_datetime).getTime() < now) return false;
        if (scope === 'past' && new Date(it.start_datetime).getTime() >= now) return false;
        return true;
      })
      .sort((a, b) => new Date(b.start_datetime).getTime() - new Date(a.start_datetime).getTime());
  }, [items, scope, filterBarber, filterKind, now]);

  // Client-side paging: the hook loads every server page so filters/stats see
  // complete data; the pager keeps the rendered list bounded.
  const [page, setPage] = usePageState(`${scope}|${String(filterBarber)}|${filterKind}`);
  const pages = pageCount(filtered.length);
  const pageItems = useMemo(
    () => filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    [filtered, page],
  );

  const stats = useMemo(
    () => ({
      total: items.length,
      upcoming: items.filter((it) => new Date(it.end_datetime).getTime() >= now).length,
      shop_wide: items.filter((it) => it.barber === null).length,
    }),
    [items, now],
  );

  const barberLabel = (id: number | null) => {
    if (id === null) return t('barbers_page.shop_wide');
    const b = (barbers ?? []).find((x) => x.id === id);
    return b ? `${b.user_first_name} ${b.user_last_name}` : `#${id}`;
  };

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow={t('page.time_off')}
        title={t('page.time_off')}
        subtitle={t('time_off.page_subtitle')}
      />

      {/* Add form */}
      <Card>
        <h2 className="font-display text-xl mb-4 tracking-tight">{t('time_off.add_title')}</h2>

        <div className="flex flex-wrap gap-2 mb-4">
          {(['day_off', 'vacation', 'custom'] as Kind[]).map((k) => (
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
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-ink">{t('time_off.f_who')}</span>
            <select
              value={barberId === 'shop' ? '' : String(barberId)}
              onChange={(e) => setBarberId(e.target.value === '' ? 'shop' : Number(e.target.value))}
              className="h-11 px-3.5 bg-surface-2 border border-line rounded-md text-[15px] focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/15"
            >
              <option value="">{t('barbers_page.shop_wide')}</option>
              {(barbers ?? []).map((b) => (
                <option key={b.id} value={b.id}>
                  {b.user_first_name} {b.user_last_name}
                </option>
              ))}
            </select>
          </label>

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

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <StatBlock label={t('time_off.stat_total')} value={stats.total} />
        <StatBlock label={t('time_off.stat_upcoming')} value={stats.upcoming} />
        <StatBlock label={t('time_off.stat_shop_wide')} value={stats.shop_wide} />
      </div>

      {/* Filters */}
      <Card>
        <div className="flex flex-wrap gap-2 mb-3">
          {(['upcoming', 'all', 'past'] as ScopeQuick[]).map((s) => (
            <Chip key={s} active={scope === s} onClick={() => setScope(s)}>
              {t(`time_off.scope_${s}`)}
            </Chip>
          ))}
        </div>
        <div className="grid sm:grid-cols-2 gap-3">
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-ink">{t('time_off.f_filter_barber')}</span>
            <select
              value={String(filterBarber)}
              onChange={(e) =>
                setFilterBarber(
                  e.target.value === 'all'
                    ? 'all'
                    : e.target.value === 'shop'
                      ? ('shop' as unknown as number)
                      : Number(e.target.value),
                )
              }
              className="h-11 px-3.5 bg-surface-2 border border-line rounded-md text-[15px] focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/15"
            >
              <option value="all">{t('time_off.filter_all_barbers')}</option>
              <option value="shop">{t('barbers_page.shop_wide')}</option>
              {(barbers ?? []).map((b) => (
                <option key={b.id} value={b.id}>
                  {b.user_first_name} {b.user_last_name}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-ink">{t('time_off.f_filter_kind')}</span>
            <select
              value={filterKind}
              onChange={(e) => setFilterKind(e.target.value as Kind | 'all')}
              className="h-11 px-3.5 bg-surface-2 border border-line rounded-md text-[15px] focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/15"
            >
              <option value="all">{t('time_off.filter_all_kinds')}</option>
              <option value="day_off">{t('time_off.kind_day_off')}</option>
              <option value="vacation">{t('time_off.kind_vacation')}</option>
              <option value="custom">{t('time_off.kind_custom')}</option>
            </select>
          </label>
        </div>
      </Card>

      {/* List */}
      {timeOff.isError ? (
        <SectionError error={timeOff.error} onRetry={() => timeOff.refetch()} />
      ) : isLoading ? (
        <Card>
          <p role="status" aria-live="polite" className="text-ink-muted text-sm">
            {t('actions.loading')}
          </p>
        </Card>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<CalendarOff className="h-5 w-5" />}
          title={t('time_off.empty_title')}
          hint={t('time_off.empty_hint')}
        />
      ) : (
        <Card>
          <div className="border border-line rounded-md overflow-hidden">
            {pageItems.map((item) => (
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
          <Pager page={page} pageCount={pages} onPageChange={setPage} className="mt-4" />
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

function Chip({
  children,
  active,
  onClick,
}: {
  children: ReactNode;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'px-4 py-1.5 rounded-pill border text-sm font-medium transition',
        active
          ? 'bg-ink text-bg border-ink'
          : 'bg-surface text-ink-muted border-line hover:border-line-strong hover:text-ink',
      )}
    >
      {children}
    </button>
  );
}

function StatBlock({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-line bg-surface px-3 py-2.5 flex flex-col gap-0.5">
      <span className="text-[10px] uppercase tracking-[0.12em] font-medium text-ink-muted">
        {label}
      </span>
      <span className="font-display text-xl font-semibold tabular-nums leading-none text-ink">
        {value}
      </span>
    </div>
  );
}
