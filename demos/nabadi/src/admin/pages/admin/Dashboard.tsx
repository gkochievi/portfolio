import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Activity,
  ArrowUpRight,
  Calendar,
  CalendarPlus,
  CircleDollarSign,
  Clock,
  ListChecks,
  Star,
  Users,
} from 'lucide-react';
import { useMe } from '@/auth/hooks';
import { Card } from '@/components/Card';
import { Button } from '@/components/Button';
import { SectionError } from '@/components/SectionError';
import {
  useAnalyticsSummary,
  useAnalyticsTopBarbers,
  useAnalyticsTopServices,
} from '@/features/admin/analytics-hooks';
import { useAdminBookings } from '@/features/admin/hooks';
import type { AdminBooking } from '@/features/admin/hooks';
import { cn } from '@/lib/cn';
import { formatMoney, formatTbilisiDate, formatTbilisiDateTime, formatTbilisiTime, tbilisiYmdOffset, todayTbilisiYmd } from '@/lib/datetime';
import { pickLocalized } from '@/lib/localized';

export function Dashboard() {
  const { t, i18n } = useTranslation('admin');
  const { data: user } = useMe();

  // "Today" is the shop's (Tbilisi) calendar date — the UTC date is still
  // yesterday between 00:00 and 04:00 local.
  const todayStr = todayTbilisiYmd();
  const weekRange = { date_from: tbilisiYmdOffset(-6), date_to: todayStr };
  const monthRange = { date_from: tbilisiYmdOffset(-29), date_to: todayStr };

  const summaryWeek = useAnalyticsSummary(weekRange);
  const summaryMonth = useAnalyticsSummary(monthRange);
  const topServices = useAnalyticsTopServices(monthRange);
  const topBarbers = useAnalyticsTopBarbers(monthRange);
  const todayBookings = useAdminBookings({ date_from: todayStr, date_to: todayStr });
  const upcomingBookings = useAdminBookings({ status: 'pending', date_from: todayStr });

  if (!user) return null;

  const greet = (() => {
    const h = new Date().getHours();
    if (h < 12) return t('greet_morning');
    if (h < 18) return t('greet_afternoon');
    return t('greet_evening');
  })();

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col md:flex-row md:items-end md:justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-accent font-medium mb-2">
            {t('dashboard')}
          </p>
          <h1 className="font-display font-semibold text-3xl md:text-4xl text-ink leading-tight tracking-tight">
            {greet}, {user.first_name}
          </h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="secondary" size="md" className="rounded-pill">
            <Link to="/walk-in">
              <CalendarPlus className="h-4 w-4" />
              {t('walk_in')}
            </Link>
          </Button>
          <Button asChild size="md" variant="accent" className="rounded-pill">
            <Link to="/bookings">
              <Calendar className="h-4 w-4" />
              {t('view_bookings')}
            </Link>
          </Button>
        </div>
      </header>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        <Stat
          icon={<Calendar className="h-4 w-4" />}
          label={t('kpi_today')}
          value={(todayBookings.data ?? []).length.toString()}
          hint={t('kpi_today_hint')}
        />
        <Stat
          icon={<ListChecks className="h-4 w-4" />}
          label={t('kpi_week')}
          value={(summaryWeek.data?.total_bookings ?? 0).toString()}
          hint={`${summaryWeek.data?.completed_bookings ?? 0} ${t('completed')}`}
        />
        <Stat
          icon={<CircleDollarSign className="h-4 w-4" />}
          label={t('kpi_revenue_30d')}
          value={formatMoney(summaryMonth.data?.revenue_completed ?? 0, i18n.language)}
          accent
        />
        <Stat
          icon={<Activity className="h-4 w-4" />}
          label={t('kpi_completion_rate')}
          value={
            summaryMonth.data ? `${(summaryMonth.data.completion_rate * 100).toFixed(0)}%` : '—'
          }
          hint={`${summaryMonth.data?.total_bookings ?? 0} ${t('bookings_30d')}`}
        />
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display text-xl text-ink tracking-tight">{t('today_schedule')}</h2>
            <Link
              to="/bookings"
              className="text-sm text-ink-muted hover:text-ink transition inline-flex items-center gap-1"
            >
              {t('see_all')}
              <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
          </div>
          <BookingsList
            loading={todayBookings.isLoading}
            error={todayBookings.isError ? todayBookings.error : null}
            onRetry={() => todayBookings.refetch()}
            bookings={todayBookings.data ?? []}
            empty={t('no_bookings_today')}
            mode="today"
          />
        </Card>

        <Card>
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display text-xl text-ink tracking-tight">{t('top_barbers_30d')}</h2>
          </div>
          <Leaderboard
            empty={t('no_data')}
            items={(topBarbers.data ?? []).map((b) => ({
              key: String(b.barber_id),
              label: `${b.first_name} ${b.last_name}`,
              count: b.count,
            }))}
            icon={<Users className="h-3.5 w-3.5" />}
          />
        </Card>

        <Card>
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display text-xl text-ink tracking-tight">
              {t('top_services_30d')}
            </h2>
          </div>
          <Leaderboard
            empty={t('no_data')}
            items={(topServices.data ?? []).map((s) => ({
              key: String(s.service_id),
              label: s.service_name,
              count: s.count,
            }))}
            icon={<Star className="h-3.5 w-3.5" />}
          />
        </Card>

        <Card className="lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display text-xl text-ink tracking-tight">
              {t('pending_to_confirm')}
            </h2>
            <Link
              to="/bookings"
              className="text-sm text-ink-muted hover:text-ink transition inline-flex items-center gap-1"
            >
              {t('see_all')}
              <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
          </div>
          <BookingsList
            loading={upcomingBookings.isLoading}
            error={upcomingBookings.isError ? upcomingBookings.error : null}
            onRetry={() => upcomingBookings.refetch()}
            bookings={upcomingBookings.data ?? []}
            empty={t('no_pending')}
            mode="upcoming"
          />
        </Card>
      </div>
    </div>
  );
}

function Stat({
  icon,
  label,
  value,
  hint,
  accent,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  hint?: string;
  accent?: boolean;
}) {
  return (
    <div
      className={cn(
        'p-5 rounded-2xl border',
        accent ? 'bg-ink text-bg border-ink' : 'bg-surface border-line',
      )}
    >
      <div
        className={cn(
          'flex items-center gap-2 text-xs font-medium',
          accent ? 'text-bg/70' : 'text-ink-muted',
        )}
      >
        <span
          className={cn(
            'inline-flex items-center justify-center w-7 h-7 rounded-pill',
            accent ? 'bg-bg/10 text-bg' : 'bg-line/60 text-ink-muted',
          )}
        >
          {icon}
        </span>
        <span>{label}</span>
      </div>
      <div
        className={cn(
          'mt-3 font-display font-semibold text-3xl tracking-tight leading-none',
          accent ? 'text-bg' : 'text-ink',
        )}
      >
        {value}
      </div>
      {hint && (
        <div className={cn('mt-1.5 text-xs', accent ? 'text-bg/50' : 'text-ink-muted')}>{hint}</div>
      )}
    </div>
  );
}

function customerLabel(b: AdminBooking): string {
  return b.customer_name || b.walk_in_name || '—';
}

/* Mirrors components/Badge.tsx: /10 tints + text-ink on the line fill —
   the /15 + ink-muted combos sit below the 4.5:1 AA floor. */
const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-accent-soft text-ink',
  confirmed: 'bg-ink text-bg',
  completed: 'bg-success/10 text-success',
  cancelled: 'bg-danger/10 text-danger',
  no_show: 'bg-line text-ink',
};

function BookingsList({
  loading,
  error,
  onRetry,
  bookings,
  empty,
  mode,
}: {
  loading: boolean;
  error?: unknown;
  onRetry?: () => void;
  bookings: AdminBooking[];
  empty: string;
  mode: 'today' | 'upcoming';
}) {
  const { t, i18n } = useTranslation('admin');
  if (error && onRetry) return <SectionError error={error} onRetry={onRetry} />;
  if (loading)
    return (
      <p role="status" aria-live="polite" className="text-sm text-ink-muted">
        {t('actions.loading')}
      </p>
    );
  if (bookings.length === 0) {
    return <p className="text-sm text-ink-muted">{empty}</p>;
  }
  const sorted = [...bookings].sort(
    (a, b) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime(),
  );
  return (
    <div className="flex flex-col divide-y divide-line">
      {sorted.slice(0, 8).map((b) => {
        const start = new Date(b.start_at);
        return (
          <div key={b.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
            {mode === 'today' ? (
              <div className="flex flex-col items-center justify-center w-14 shrink-0 text-center font-display tabular-nums">
                <span className="text-[10px] uppercase tracking-wider text-ink-muted">
                  {formatTbilisiDate(start, undefined, { weekday: 'short' })}
                </span>
                <span className="font-semibold text-base text-ink leading-tight">
                  {formatTbilisiTime(start)}
                </span>
              </div>
            ) : (
              <span className="inline-flex items-center justify-center w-9 h-9 rounded-pill bg-accent-soft text-ink shrink-0">
                <Clock className="h-4 w-4" />
              </span>
            )}
            <div className="flex-1 min-w-0">
              <div className="text-sm text-ink font-medium truncate">
                {pickLocalized(b.service_name, b.service_name_en, i18n.language)}
              </div>
              <div className="text-xs text-ink-muted truncate">
                {customerLabel(b)} · {b.barber_name}
                {mode === 'upcoming' && ` · ${formatTbilisiDateTime(start)}`}
              </div>
            </div>
            <span
              className={cn(
                'text-xs font-medium px-2.5 py-1 rounded-pill shrink-0',
                STATUS_COLORS[b.status] ?? 'bg-line text-ink',
              )}
            >
              {t(`status.${b.status}`)}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function Leaderboard({
  items,
  empty,
  icon,
}: {
  items: { key: string; label: string; count: number }[];
  empty: string;
  icon: ReactNode;
}) {
  if (items.length === 0) {
    return <p className="text-sm text-ink-muted">{empty}</p>;
  }
  const max = Math.max(...items.map((i) => i.count), 1);
  return (
    <div className="flex flex-col gap-3">
      {items.slice(0, 5).map((it) => (
        <div key={it.key} className="flex items-center gap-3">
          <span className="inline-flex items-center justify-center w-7 h-7 rounded-pill bg-line/60 text-ink-muted shrink-0">
            {icon}
          </span>
          <div className="flex-1 min-w-0">
            <div className="text-sm text-ink truncate">{it.label}</div>
            <div className="mt-1 h-1 rounded-pill bg-line overflow-hidden">
              <div
                className="h-full rounded-pill bg-accent"
                style={{ width: `${(it.count / max) * 100}%` }}
              />
            </div>
          </div>
          <span className="text-sm font-medium text-ink tabular-nums shrink-0">{it.count}</span>
        </div>
      ))}
    </div>
  );
}
