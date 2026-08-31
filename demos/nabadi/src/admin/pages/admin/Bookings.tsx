import { useMemo, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  CalendarDays,
  CalendarPlus,
  ChevronLeft,
  ChevronRight,
  Download,
  List,
  Search,
  X,
} from 'lucide-react';
import { Button } from '@/components/Button';
import { Input } from '@/components/Input';
import { Card } from '@/components/Card';
import { Pager } from '@/components/Pager';
import { SectionError } from '@/components/SectionError';
import { Stat } from '@/components/Stat';
import { BookingsTable } from '@/features/admin/components/BookingsTable';
import { BookingDetailSheet } from '@/features/admin/components/BookingDetailSheet';
import { BookingsCalendar } from '@/features/admin/components/BookingsCalendar';
import { weekdayMondayIdx } from '@/features/admin/calendar-utils';
import { useAdminShopHours } from '@/features/admin/crud-hooks';
import {
  downloadBookingsXlsx,
  useAdminBarbers,
  useAdminBookingsDay,
  useAdminBookingsPage,
  useAdminServices,
  type AdminBooking,
  type BookingsFilters,
} from '@/features/admin/hooks';
import { useMutationFeedback } from '@/features/admin/mutation-feedback';
import { cn } from '@/lib/cn';
import {
  TBILISI_TZ,
  addDaysYmd,
  formatMoney,
  tbilisiYmdOffset,
  todayTbilisiYmd,
} from '@/lib/datetime';
import { pageCount, usePageState } from '@/lib/paginated';
import { pickLocalized } from '@/lib/localized';
import { useDebouncedValue } from '@/lib/useDebouncedValue';

const STATUSES = ['pending', 'confirmed', 'completed', 'cancelled', 'no_show'] as const;

type QuickKey = 'today' | 'tomorrow' | 'week' | 'pending' | 'walkins' | null;

type ViewMode = 'list' | 'calendar';

/** localStorage key for the persisted calendar/list choice (spec §9.2). */
const VIEW_STORAGE_KEY = 'admin.bookings.view';

function loadView(): ViewMode {
  try {
    return localStorage.getItem(VIEW_STORAGE_KEY) === 'calendar' ? 'calendar' : 'list';
  } catch {
    return 'list';
  }
}

export function AdminBookings() {
  const { t, i18n } = useTranslation('admin');
  const [view, setViewState] = useState<ViewMode>(loadView);
  const [filters, setFilters] = useState<BookingsFilters>({});
  const [search, setSearch] = useState('');
  const [quick, setQuick] = useState<QuickKey>(null);
  const [openId, setOpenId] = useState<number | null>(null);
  const [exporting, setExporting] = useState(false);
  const [calDate, setCalDate] = useState<string>(todayTbilisiYmd);
  const feedback = useMutationFeedback();

  const setView = (v: ViewMode) => {
    setViewState(v);
    try {
      localStorage.setItem(VIEW_STORAGE_KEY, v);
    } catch {
      /* storage unavailable — choice just won't persist */
    }
  };
  const isCalendar = view === 'calendar';

  const { data: barbers } = useAdminBarbers();
  const { data: services } = useAdminServices();

  // --- List view: server-paged (DRF envelope). Search goes server-side via
  // the viewset's customer_phone filter (matches customer AND walk-in phones,
  // icontains) — the only free-text param the endpoint supports.
  const debouncedSearch = useDebouncedValue(search);
  const serverFilters = useMemo<BookingsFilters>(
    () => ({ ...filters, customer_phone: debouncedSearch.trim() || undefined }),
    [filters, debouncedSearch],
  );
  const [page, setPage] = usePageState(JSON.stringify(serverFilters));
  const bookingsQuery = useAdminBookingsPage(serverFilters, page, !isCalendar);
  const { isLoading } = bookingsQuery;
  const pageRows = useMemo(() => bookingsQuery.data?.results ?? [], [bookingsQuery.data]);
  const totalCount = bookingsQuery.data?.count ?? 0;
  const pages = pageCount(totalCount);

  // --- Calendar view: the WHOLE day across all envelope pages, one lane per
  // active barber. Cancelled bookings don't hold the slot — hide them so a
  // rebooked slot doesn't render two overlapping blocks.
  const dayQuery = useAdminBookingsDay(isCalendar ? calDate : null);
  const dayBookings = useMemo(
    () => (dayQuery.data ?? []).filter((b) => b.status !== 'cancelled'),
    [dayQuery.data],
  );
  const activeBarbers = useMemo(() => (barbers ?? []).filter((b) => b.is_active), [barbers]);
  const shopHours = useAdminShopHours(isCalendar);
  const shopRow = shopHours.data?.find((r) => r.weekday === weekdayMondayIdx(calDate)) ?? null;

  const calDayLabel = useMemo(
    () =>
      new Intl.DateTimeFormat(i18n.language, {
        timeZone: TBILISI_TZ,
        weekday: 'long',
        day: 'numeric',
        month: 'long',
      }).format(new Date(`${calDate}T12:00:00Z`)),
    [calDate, i18n.language],
  );

  const onExport = async () => {
    setExporting(true);
    try {
      // The export endpoint requires an explicit date range; in calendar view
      // export exactly the rendered day.
      await downloadBookingsXlsx(
        isCalendar ? { date_from: calDate, date_to: calDate } : serverFilters,
      );
    } catch (err) {
      feedback.error(err);
    } finally {
      setExporting(false);
    }
  };

  // Walk-ins-only is a client-side refinement of the CURRENT page — the
  // endpoint has no walk_in param. The stats note flags the page scoping.
  const filtered = useMemo(
    () => (quick === 'walkins' ? pageRows.filter((b) => b.customer === null) : pageRows),
    [pageRows, quick],
  );

  // Page-scoped status/revenue tallies; the total comes from the envelope
  // count (server truth across all pages).
  const counts = useMemo(() => {
    const c: Record<string, number> = {
      pending: 0,
      confirmed: 0,
      completed: 0,
      cancelled: 0,
      no_show: 0,
      revenue: 0,
    };
    for (const b of filtered) {
      c[b.status] = (c[b.status] ?? 0) + 1;
      if (b.status === 'completed') c.revenue += Number(b.price_at_booking);
    }
    return c;
  }, [filtered]);

  const isFiltered =
    !!filters.status ||
    !!filters.barber_id ||
    !!filters.service_id ||
    !!filters.date_from ||
    !!filters.date_to ||
    !!search ||
    quick !== null;

  const clearAll = () => {
    setFilters({});
    setSearch('');
    setQuick(null);
  };

  // Manual status/date edits must un-highlight a quick chip whose meaning
  // they contradict ('walkins' is orthogonal — it only filters client-side).
  const setFiltersManual = (next: BookingsFilters) => {
    setFilters(next);
    if (quick !== null && quick !== 'walkins') setQuick(null);
  };

  const setQuickFilter = (k: QuickKey) => {
    if (quick === k) {
      setQuick(null);
      setFilters((f) => ({
        ...f,
        status: undefined,
        date_from: undefined,
        date_to: undefined,
      }));
      return;
    }
    setQuick(k);
    if (k === 'today') {
      const d = todayTbilisiYmd();
      setFilters((f) => ({
        ...f,
        status: undefined,
        date_from: d,
        date_to: d,
      }));
    } else if (k === 'tomorrow') {
      const d = tbilisiYmdOffset(1);
      setFilters((f) => ({
        ...f,
        status: undefined,
        date_from: d,
        date_to: d,
      }));
    } else if (k === 'week') {
      setFilters((f) => ({
        ...f,
        status: undefined,
        date_from: todayTbilisiYmd(),
        date_to: tbilisiYmdOffset(6),
      }));
    } else if (k === 'pending') {
      setFilters((f) => ({
        ...f,
        status: 'pending',
        date_from: undefined,
        date_to: undefined,
      }));
    } else if (k === 'walkins') {
      setFilters((f) => ({ ...f, status: undefined }));
    }
  };

  // The sheet's booking may live on the current list page OR in the calendar
  // day — whichever view opened it.
  const opened =
    openId !== null
      ? (pageRows.find((b) => b.id === openId) ??
        (dayQuery.data ?? []).find((b: AdminBooking) => b.id === openId) ??
        null)
      : null;

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col md:flex-row md:items-end md:justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-accent font-medium mb-2">
            {t('page.bookings')}
          </p>
          <h1 className="font-display font-semibold text-3xl md:text-4xl text-ink leading-tight tracking-tight">
            {t('page.bookings')}
          </h1>
          <p className="text-sm text-ink-muted mt-1">{t('bookings.subtitle')}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ViewToggle view={view} onChange={setView} />
          <Button
            variant="secondary"
            onClick={onExport}
            loading={exporting}
            className="rounded-pill"
          >
            <Download className="h-4 w-4" />
            {t('bookings.export_xlsx')}
          </Button>
          <Button asChild size="md" variant="accent" className="rounded-pill">
            <Link to="/walk-in">
              <CalendarPlus className="h-4 w-4" />
              {t('bookings.new')}
            </Link>
          </Button>
        </div>
      </header>

      {isCalendar ? (
        <>
          <Card className="flex flex-wrap items-center gap-2 p-4">
            <Button
              variant="secondary"
              size="sm"
              className="rounded-pill"
              onClick={() => setCalDate((d) => addDaysYmd(d, -1))}
              aria-label={t('bookings.cal_prev_day')}
            >
              <ChevronLeft className="h-4 w-4" aria-hidden />
            </Button>
            <Button
              variant="secondary"
              size="sm"
              className="rounded-pill"
              onClick={() => setCalDate(todayTbilisiYmd())}
            >
              {t('bookings.cal_today')}
            </Button>
            <Button
              variant="secondary"
              size="sm"
              className="rounded-pill"
              onClick={() => setCalDate((d) => addDaysYmd(d, 1))}
              aria-label={t('bookings.cal_next_day')}
            >
              <ChevronRight className="h-4 w-4" aria-hidden />
            </Button>
            <label className="flex items-center gap-2 ml-1">
              <span className="sr-only">{t('bookings.cal_date_label')}</span>
              <input
                type="date"
                value={calDate}
                onChange={(e) => e.target.value && setCalDate(e.target.value)}
                className="h-9 px-3 bg-surface-2 border border-line rounded-md text-sm tabular-nums focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/15"
              />
            </label>
            <span className="text-sm text-ink-muted ml-auto">{calDayLabel}</span>
          </Card>

          {dayQuery.isError ? (
            <SectionError error={dayQuery.error} onRetry={() => dayQuery.refetch()} />
          ) : dayQuery.isLoading ? (
            <Card>
              <p role="status" aria-live="polite" className="text-ink-muted text-sm">
                {t('actions.loading')}
              </p>
            </Card>
          ) : (
            <BookingsCalendar
              bookings={dayBookings}
              barbers={activeBarbers}
              shopRow={shopRow}
              onBookingClick={setOpenId}
              walkInHref={(barberId) => `/walk-in?barber_id=${barberId}&date=${calDate}`}
            />
          )}
        </>
      ) : (
        <>
          <div className="flex flex-wrap gap-2">
            <Chip active={quick === 'today'} onClick={() => setQuickFilter('today')}>
              {t('bookings.filter_today')}
            </Chip>
            <Chip active={quick === 'tomorrow'} onClick={() => setQuickFilter('tomorrow')}>
              {t('bookings.filter_tomorrow')}
            </Chip>
            <Chip active={quick === 'week'} onClick={() => setQuickFilter('week')}>
              {t('bookings.filter_week')}
            </Chip>
            <Chip active={quick === 'pending'} onClick={() => setQuickFilter('pending')}>
              {t('bookings.filter_pending')}
            </Chip>
            <Chip active={quick === 'walkins'} onClick={() => setQuickFilter('walkins')}>
              {t('bookings.filter_walkins')}
            </Chip>
            {isFiltered && (
              <button
                type="button"
                onClick={clearAll}
                className="ml-auto inline-flex items-center gap-1.5 text-sm text-ink-muted hover:text-ink transition px-3 py-1.5 rounded-pill hover:bg-line/50"
              >
                <X className="h-3.5 w-3.5" />
                {t('bookings.filter_clear')}
              </button>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <div className="grid grid-cols-3 md:grid-cols-7 gap-2 md:gap-3">
              <Stat label={t('bookings.stats_total')} value={totalCount} variant="ink" />
              <Stat label={t('bookings.stats_pending')} value={counts.pending} variant="accent" />
              <Stat label={t('bookings.stats_confirmed')} value={counts.confirmed} />
              <Stat
                label={t('bookings.stats_completed')}
                value={counts.completed}
                variant="success"
              />
              <Stat
                label={t('bookings.stats_cancelled')}
                value={counts.cancelled}
                variant="danger"
              />
              <Stat label={t('bookings.stats_no_show')} value={counts.no_show} />
              <Stat
                label={t('bookings.stats_revenue')}
                value={formatMoney(counts.revenue, i18n.language)}
                variant="accent"
              />
            </div>
            {pages > 1 && <p className="text-xs text-ink-muted">{t('bookings.stats_page_note')}</p>}
          </div>

          <Card>
            <div className="grid sm:grid-cols-2 lg:grid-cols-6 gap-3">
              <label className="flex flex-col gap-1.5 lg:col-span-2">
                <span className="text-sm font-medium text-ink">{t('bookings.filter_search')}</span>
                <div className="relative">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-ink-muted pointer-events-none" />
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder={t('bookings.filter_search_placeholder')}
                    className={cn(
                      'h-11 pl-10 pr-3.5 w-full bg-surface-2 border border-line rounded-md text-[15px] text-ink',
                      'placeholder:text-ink-muted/60',
                      'focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/15',
                      'transition',
                    )}
                  />
                </div>
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-sm font-medium text-ink">{t('bookings.filter_status')}</span>
                <select
                  value={filters.status ?? ''}
                  onChange={(e) =>
                    setFiltersManual({ ...filters, status: e.target.value || undefined })
                  }
                  className="h-11 px-3.5 bg-surface-2 border border-line rounded-md focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/15 text-[15px]"
                >
                  <option value="">{t('bookings.filter_status_all')}</option>
                  {STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {t(`status.${s}`)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-sm font-medium text-ink">{t('bookings.filter_barber')}</span>
                <select
                  value={filters.barber_id ?? ''}
                  onChange={(e) =>
                    setFilters({
                      ...filters,
                      barber_id: e.target.value ? Number(e.target.value) : undefined,
                    })
                  }
                  className="h-11 px-3.5 bg-surface-2 border border-line rounded-md focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/15 text-[15px]"
                >
                  <option value="">{t('bookings.filter_barber_all')}</option>
                  {barbers?.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.user_first_name} {b.user_last_name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-sm font-medium text-ink">{t('bookings.filter_service')}</span>
                <select
                  value={filters.service_id ?? ''}
                  onChange={(e) =>
                    setFilters({
                      ...filters,
                      service_id: e.target.value ? Number(e.target.value) : undefined,
                    })
                  }
                  className="h-11 px-3.5 bg-surface-2 border border-line rounded-md focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/15 text-[15px]"
                >
                  <option value="">{t('bookings.filter_service_all')}</option>
                  {services?.map((s) => (
                    <option key={s.id} value={s.id}>
                      {pickLocalized(s.name, s.name_en, i18n.language)}
                    </option>
                  ))}
                </select>
              </label>
              <Input
                label={t('bookings.filter_from')}
                type="date"
                value={filters.date_from ?? ''}
                onChange={(e) =>
                  setFiltersManual({ ...filters, date_from: e.target.value || undefined })
                }
              />
              <Input
                label={t('bookings.filter_to')}
                type="date"
                value={filters.date_to ?? ''}
                onChange={(e) =>
                  setFiltersManual({ ...filters, date_to: e.target.value || undefined })
                }
              />
            </div>
          </Card>

          {bookingsQuery.isError ? (
            <SectionError error={bookingsQuery.error} onRetry={() => bookingsQuery.refetch()} />
          ) : isLoading ? (
            <Card>
              <p role="status" aria-live="polite" className="text-ink-muted text-sm">
                {t('actions.loading')}
              </p>
            </Card>
          ) : filtered.length === 0 ? (
            <Card className="text-center py-14">
              <h3 className="font-display text-xl text-ink tracking-tight">
                {t('bookings.empty_title')}
              </h3>
              <p className="text-sm text-ink-muted mt-1">{t('bookings.empty_hint')}</p>
              {isFiltered && (
                <Button variant="ghost" className="mt-4 mx-auto rounded-pill" onClick={clearAll}>
                  <X className="h-4 w-4" />
                  {t('bookings.filter_clear')}
                </Button>
              )}
            </Card>
          ) : (
            <>
              <BookingsTable bookings={filtered} onRowClick={setOpenId} />
              <Pager page={page} pageCount={pages} onPageChange={setPage} />
            </>
          )}
        </>
      )}

      <BookingDetailSheet
        booking={opened}
        open={openId !== null}
        onOpenChange={(open) => !open && setOpenId(null)}
      />
    </div>
  );
}

function ViewToggle({ view, onChange }: { view: ViewMode; onChange: (v: ViewMode) => void }) {
  const { t } = useTranslation('admin');
  const btn = (active: boolean) =>
    cn(
      'inline-flex items-center gap-1.5 text-sm font-medium px-3.5 h-10 transition',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent/40',
      active ? 'bg-ink text-bg' : 'bg-surface text-ink-muted hover:text-ink',
    );
  return (
    <div
      role="group"
      aria-label={t('bookings.view_toggle_label')}
      className="inline-flex border border-line rounded-pill overflow-hidden"
    >
      <button
        type="button"
        onClick={() => onChange('list')}
        aria-pressed={view === 'list'}
        className={btn(view === 'list')}
      >
        <List className="h-4 w-4" aria-hidden />
        {t('bookings.view_list')}
      </button>
      <button
        type="button"
        onClick={() => onChange('calendar')}
        aria-pressed={view === 'calendar'}
        className={btn(view === 'calendar')}
      >
        <CalendarDays className="h-4 w-4" aria-hidden />
        {t('bookings.view_calendar')}
      </button>
    </div>
  );
}

function Chip({
  children,
  active,
  onClick,
}: {
  children: ReactNode;
  active?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'inline-flex items-center gap-1.5 text-sm font-medium px-4 py-1.5 rounded-pill border transition',
        active
          ? 'bg-ink text-bg border-ink'
          : 'bg-surface text-ink-muted border-line hover:border-line-strong hover:text-ink',
      )}
    >
      {children}
    </button>
  );
}
