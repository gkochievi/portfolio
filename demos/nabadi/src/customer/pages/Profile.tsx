import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslation } from 'react-i18next';
import { useState, type ReactNode } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Calendar, Check, LogOut, Phone, Plus, X } from 'lucide-react';
import { Layout } from '@/components/Layout';
import { Container } from '@/components/Container';
import { Button } from '@/components/Button';
import { Input } from '@/components/Input';
import { ErrorMessage } from '@/components/ErrorMessage';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/Tabs';
import { SectionError } from '@/components/SectionError';
import { Skeleton } from '@/components/Skeleton';
import { useChangePassword, useLogout, useMe, useUpdateMe } from '@/auth/hooks';
import {
  changePasswordSchema,
  meUpdateSchema,
  type ChangePasswordInput,
  type MeUpdateInput,
} from '@/auth/schemas';
import { BookingListItem } from '@/features/booking/components/BookingListItem';
import { useMyBookings, useMyBookingsStats, type MyBookingsStatus } from '@/features/booking/hooks';
import { formatMoney } from '@/lib/datetime';
import { cn } from '@/lib/cn';

function relativeTime(iso: string | null, language: string, fallback: string): string {
  if (!iso) return fallback;
  const ms = Date.now() - new Date(iso).getTime();
  const days = Math.floor(ms / 86_400_000);
  const fmt = new Intl.RelativeTimeFormat(language, { numeric: 'auto' });
  if (days < 1) return fmt.format(0, 'day');
  if (days < 31) return fmt.format(-days, 'day');
  const months = Math.floor(days / 30);
  if (months < 12) return fmt.format(-months, 'month');
  return fmt.format(-Math.floor(days / 365), 'year');
}

export function Profile() {
  const { t, i18n } = useTranslation('profile');
  const { t: tCommon } = useTranslation('common');
  const { data: user } = useMe();
  const stats = useMyBookingsStats();
  const logout = useLogout();
  const [searchParams, setSearchParams] = useSearchParams();
  const [bookedDismissed, setBookedDismissed] = useState(false);
  const showBooked = searchParams.get('booked') === '1' && !bookedDismissed;

  const dismissBooked = () => {
    setBookedDismissed(true);
    const next = new URLSearchParams(searchParams);
    next.delete('booked');
    setSearchParams(next, { replace: true });
  };

  if (!user) return null;

  const initial = (user.first_name?.[0] ?? user.phone?.[0] ?? '?').toUpperCase();
  const memberSince = user.date_joined ? new Date(user.date_joined) : null;

  return (
    <Layout>
      <Container size="md" className="py-12 md:py-16">
        {showBooked && (
          <div
            role="status"
            aria-live="polite"
            className="mb-6 flex items-start gap-3 rounded-2xl border border-success/40 bg-success/5 px-4 py-3"
          >
            <Check className="h-5 w-5 text-success shrink-0 mt-0.5" aria-hidden />
            <div className="flex-1">
              <p className="text-sm font-medium text-success">{t('booking_confirmed_title')}</p>
              <p className="text-xs text-ink-muted mt-0.5">{t('booking_confirmed_body')}</p>
            </div>
            <button
              type="button"
              onClick={dismissBooked}
              aria-label={t('dismiss')}
              className="text-ink-muted hover:text-ink transition shrink-0"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}
        {/* Hero header */}
        <header className="flex flex-col sm:flex-row gap-5 items-start sm:items-center mb-8">
          <span
            className="inline-flex items-center justify-center w-16 h-16 rounded-pill bg-ink text-bg font-display text-2xl font-medium shrink-0"
            aria-hidden
          >
            {initial}
          </span>
          <div className="flex-1 min-w-0">
            <h1 className="font-display text-3xl md:text-4xl text-ink leading-tight tracking-tight [overflow-wrap:anywhere]">
              {user.first_name} {user.last_name}
            </h1>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-ink-muted mt-1">
              <span className="inline-flex items-center gap-1.5 tabular-nums">
                <Phone className="h-3.5 w-3.5" />
                {user.phone}
              </span>
              {memberSince && (
                <span className="inline-flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5" />
                  {t('member_since', {
                    date: memberSince.toLocaleDateString(i18n.language, {
                      year: 'numeric',
                      month: 'long',
                    }),
                  })}
                </span>
              )}
            </div>
          </div>
          <div className="flex flex-wrap gap-2 self-stretch sm:self-auto">
            <Button asChild variant="accent" className="rounded-pill">
              <Link to="/book">
                <Plus className="h-4 w-4" />
                {t('new_booking')}
              </Link>
            </Button>
            <Button
              variant="ghost"
              onClick={() => logout.mutate()}
              loading={logout.isPending}
              aria-label={tCommon('logout')}
              className="rounded-pill text-ink-muted hover:text-danger"
            >
              <LogOut className="h-4 w-4" aria-hidden />
            </Button>
          </div>
        </header>

        {/* Stats band — reserve the space while loading so the tabs don't
            jump down when the numbers arrive. On error the band is omitted
            deliberately (acceptable degradation for a summary strip). */}
        {stats.isLoading && (
          <div role="status" aria-busy="true" className="grid grid-cols-3 gap-3 mb-8">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-[86px]" />
            ))}
            <span className="sr-only">{t('loading')}</span>
          </div>
        )}
        {stats.data && (
          <div className="grid grid-cols-3 gap-3 mb-8">
            <Stat
              label={t('stat_bookings')}
              value={stats.data.total_bookings}
              hint={
                stats.data.upcoming_bookings > 0
                  ? t('stat_upcoming_hint', { count: stats.data.upcoming_bookings })
                  : undefined
              }
              accent
            />
            <Stat
              label={t('stat_spent')}
              value={formatMoney(stats.data.total_spent, i18n.language)}
              hint={
                stats.data.completed_bookings > 0
                  ? t('stat_completed_hint', { count: stats.data.completed_bookings })
                  : undefined
              }
            />
            <Stat
              label={t('stat_last_visit')}
              value={relativeTime(stats.data.last_visit_at, i18n.language, '—')}
            />
          </div>
        )}

        <Tabs defaultValue="bookings">
          <TabsList>
            <TabsTrigger value="bookings">{t('tab_bookings')}</TabsTrigger>
            <TabsTrigger value="account">{t('tab_account')}</TabsTrigger>
          </TabsList>

          <TabsContent value="bookings">
            <BookingsPanel />
          </TabsContent>

          <TabsContent value="account">
            <AccountPanel />
          </TabsContent>
        </Tabs>
      </Container>
    </Layout>
  );
}

function Stat({
  label,
  value,
  hint,
  accent,
}: {
  label: string;
  value: number | string;
  hint?: string;
  accent?: boolean;
}) {
  return (
    // Accent stays a border indicator — never an accent-soft slab fill.
    <div
      className={cn(
        'rounded-2xl border px-4 py-3 flex flex-col gap-0.5 bg-surface text-ink',
        accent ? 'border-accent' : 'border-line',
      )}
    >
      <span className="text-[10px] uppercase tracking-[0.12em] font-medium text-ink-muted">
        {label}
      </span>
      <span className="font-display text-xl sm:text-2xl font-semibold tabular-nums leading-none mt-1">
        {value}
      </span>
      {hint && <span className="text-xs text-ink-muted mt-1">{hint}</span>}
    </div>
  );
}

function BookingsPanel() {
  const { t } = useTranslation('profile');
  const [tab, setTab] = useState<MyBookingsStatus>('upcoming');
  const [page, setPage] = useState(1);
  const myBookings = useMyBookings(tab, page);

  const tabs: { id: MyBookingsStatus; label: ReactNode }[] = [
    { id: 'upcoming', label: t('bookings_upcoming') },
    { id: 'past', label: t('bookings_past') },
    { id: 'cancelled', label: t('bookings_cancelled') },
  ];

  const switchTab = (id: MyBookingsStatus) => {
    setTab(id);
    setPage(1); // a new filter starts back at the first page
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap gap-2">
        {tabs.map((tt) => (
          <button
            key={tt.id}
            type="button"
            onClick={() => switchTab(tt.id)}
            aria-pressed={tab === tt.id}
            className={cn(
              'px-4 py-1.5 rounded-pill border text-sm font-medium transition',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 focus-visible:ring-offset-2 focus-visible:ring-offset-bg',
              tab === tt.id
                ? 'bg-ink text-bg border-ink'
                : 'bg-surface text-ink-muted border-line hover:border-line-strong hover:text-ink',
            )}
          >
            {tt.label}
          </button>
        ))}
      </div>

      {myBookings.isLoading && (
        <div role="status" aria-live="polite" aria-busy="true" className="flex flex-col gap-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-28" />
          ))}
          <span className="sr-only">{t('loading')}</span>
        </div>
      )}
      {myBookings.isError && (
        <SectionError error={myBookings.error} onRetry={() => myBookings.refetch()} />
      )}
      {myBookings.data && myBookings.data.results.length === 0 && (
        <div className="bg-surface border border-line rounded-2xl p-10 text-center">
          <p className="text-ink-muted">{t('no_bookings', { context: tab })}</p>
          {tab === 'upcoming' && (
            <Button asChild variant="accent" className="rounded-pill mt-5">
              <Link to="/book">
                <Plus className="h-4 w-4" />
                {t('new_booking')}
              </Link>
            </Button>
          )}
        </div>
      )}
      <div className="flex flex-col gap-3">
        {myBookings.data?.results.map((b) => (
          <BookingListItem key={b.id} booking={b} />
        ))}
      </div>

      {/* DRF paginates /bookings/me/ (25/page) — regulars with longer
          histories page through instead of silently losing older bookings. */}
      {myBookings.data && (myBookings.data.next || myBookings.data.previous) && (
        <div className="flex items-center justify-between">
          <Button
            variant="secondary"
            size="sm"
            className="rounded-pill"
            disabled={!myBookings.data.previous || myBookings.isFetching}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            {t('pager_prev')}
          </Button>
          <span className="text-xs text-ink-muted tabular-nums">{t('pager_page', { page })}</span>
          <Button
            variant="secondary"
            size="sm"
            className="rounded-pill"
            disabled={!myBookings.data.next || myBookings.isFetching}
            onClick={() => setPage((p) => p + 1)}
          >
            {t('pager_next')}
          </Button>
        </div>
      )}
    </div>
  );
}

function AccountPanel() {
  const { t } = useTranslation('profile');
  const { t: tAuth } = useTranslation('auth');
  const { data: user } = useMe();
  const updateMe = useUpdateMe();
  const changePassword = useChangePassword();
  const [profileSaved, setProfileSaved] = useState(false);
  const [pwSaved, setPwSaved] = useState(false);

  const meForm = useForm<MeUpdateInput>({
    resolver: zodResolver(meUpdateSchema),
    defaultValues: {
      first_name: user?.first_name ?? '',
      last_name: user?.last_name ?? '',
      email: user?.email ?? '',
    },
  });

  const pwForm = useForm<ChangePasswordInput>({
    resolver: zodResolver(changePasswordSchema),
  });

  const onUpdateMe = meForm.handleSubmit(async (data) => {
    setProfileSaved(false);
    try {
      await updateMe.mutateAsync({
        ...data,
        email: data.email && data.email !== '' ? data.email : null,
      });
      setProfileSaved(true);
    } catch {
      /* surfaced */
    }
  });

  const onChangePassword = pwForm.handleSubmit(async (data) => {
    setPwSaved(false);
    try {
      await changePassword.mutateAsync(data);
      setPwSaved(true);
      pwForm.reset();
    } catch {
      /* surfaced */
    }
  });

  return (
    <div className="grid md:grid-cols-2 gap-6">
      <section className="bg-surface border border-line rounded-2xl p-6">
        <h2 className="font-display text-xl mb-1 tracking-tight">
          {tAuth('profile.account_section')}
        </h2>
        <p className="text-xs text-ink-muted mb-4">{t('account_hint')}</p>
        <form onSubmit={onUpdateMe} className="flex flex-col gap-3">
          <Input
            label={t('first_name')}
            error={meForm.formState.errors.first_name?.message}
            {...meForm.register('first_name')}
          />
          <Input
            label={t('last_name')}
            error={meForm.formState.errors.last_name?.message}
            {...meForm.register('last_name')}
          />
          <Input
            label={t('phone')}
            value={user?.phone ?? ''}
            disabled
            readOnly
            hint={t('phone_immutable_hint')}
          />
          <Input
            label={t('email')}
            type="email"
            error={meForm.formState.errors.email?.message}
            {...meForm.register('email')}
          />
          <Button
            type="submit"
            variant="accent"
            loading={updateMe.isPending}
            className="self-start mt-2 rounded-pill"
          >
            {t('save_changes')}
          </Button>
          <ErrorMessage error={updateMe.error} />
          {profileSaved && (
            <span role="status" aria-live="polite" className="text-success text-xs">
              {tAuth('profile.profile_updated')}
            </span>
          )}
        </form>
      </section>

      <section className="bg-surface border border-line rounded-2xl p-6">
        <h2 className="font-display text-xl mb-1 tracking-tight">{t('change_password')}</h2>
        <p className="text-xs text-ink-muted mb-4">{t('change_password_hint')}</p>
        <form onSubmit={onChangePassword} className="flex flex-col gap-3">
          <Input
            label={t('current_password')}
            type="password"
            error={pwForm.formState.errors.old_password?.message}
            autoComplete="current-password"
            {...pwForm.register('old_password')}
          />
          <Input
            label={t('new_password')}
            type="password"
            error={pwForm.formState.errors.new_password?.message}
            autoComplete="new-password"
            {...pwForm.register('new_password')}
          />
          <Button
            type="submit"
            variant="accent"
            loading={changePassword.isPending}
            className="self-start mt-2 rounded-pill"
          >
            {t('change_password')}
          </Button>
          <ErrorMessage error={changePassword.error} />
          {pwSaved && (
            <span role="status" aria-live="polite" className="text-success text-xs">
              {t('password_changed')}
            </span>
          )}
        </form>
      </section>
    </div>
  );
}
