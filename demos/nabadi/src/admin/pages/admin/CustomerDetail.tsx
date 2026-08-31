import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, CalendarClock, Mail, Phone, Save } from 'lucide-react';
import { Badge } from '@/components/Badge';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { ErrorMessage } from '@/components/ErrorMessage';
import { Pager } from '@/components/Pager';
import { SectionError } from '@/components/SectionError';
import { Stat } from '@/components/Stat';
import { BookingDetailSheet } from '@/features/admin/components/BookingDetailSheet';
import {
  useAdminBookingsPage,
  useAdminCustomerDetail,
  useAdminUpdateCustomer,
  type AdminBooking,
  type AdminCustomer,
} from '@/features/admin/hooks';
import { pageCount, usePageState } from '@/lib/paginated';
import { formatMoney, formatTbilisiDate, formatTbilisiTime } from '@/lib/datetime';
import { pickLocalized } from '@/lib/localized';

const STATUS_VARIANTS: Record<
  AdminBooking['status'],
  'accent' | 'ink' | 'success' | 'danger' | 'default'
> = {
  pending: 'accent',
  confirmed: 'ink',
  completed: 'success',
  cancelled: 'danger',
  no_show: 'default',
};

/**
 * Customer detail (spec §9.3): identity + totals, staff notes, and the
 * customer's booking history. The bookings endpoint has no customer_id
 * filter (committed API), so history is matched on the customer's full
 * E.164 phone — which also surfaces walk-in bookings recorded under the
 * same number (a feature at the reception desk).
 *
 * The no-show total lives here (not as a list column) because the customers
 * serializer doesn't expose no_show_count; it's derived from the paginated
 * bookings envelope `count` with status=no_show.
 */
export function CustomerDetail() {
  const { t, i18n } = useTranslation('admin');
  const { id } = useParams<{ id: string }>();
  const customerId = id ? Number(id) : null;
  const customerQuery = useAdminCustomerDetail(customerId);
  const customer = customerQuery.data;

  if (customerQuery.isError) {
    return (
      <div className="flex flex-col gap-4">
        <BackLink />
        <SectionError error={customerQuery.error} onRetry={() => customerQuery.refetch()} />
      </div>
    );
  }
  if (customerQuery.isLoading) {
    return (
      <p role="status" aria-live="polite" className="text-ink-muted">
        {t('actions.loading')}
      </p>
    );
  }
  if (!customer || !customerId) {
    return (
      <div>
        <BackLink />
        <p className="text-ink-muted mt-4">{t('not_found')}</p>
      </div>
    );
  }

  const fullName = `${customer.first_name} ${customer.last_name}`.trim() || customer.phone;

  return (
    <div className="flex flex-col gap-6 max-w-4xl">
      <BackLink />

      {/* Identity card */}
      <Card>
        <div className="flex flex-col sm:flex-row gap-4 items-start">
          <span
            className="inline-flex items-center justify-center w-14 h-14 rounded-pill bg-ink text-bg font-display text-xl shrink-0"
            aria-hidden
          >
            {(customer.first_name?.[0] || customer.phone?.[0] || '?').toUpperCase()}
          </span>
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-3 mb-1.5">
              <h1 className="font-display text-3xl text-ink tracking-tight leading-tight">
                {fullName}
              </h1>
              <Badge variant={customer.is_active ? 'success' : 'danger'}>
                {customer.is_active ? t('customers.active') : t('customers.inactive')}
              </Badge>
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-ink-muted">
              <a
                href={`tel:${customer.phone}`}
                className="inline-flex items-center gap-1.5 hover:text-ink transition tabular-nums"
              >
                <Phone className="h-3.5 w-3.5" />
                {customer.phone}
              </a>
              {customer.email ? (
                <a
                  href={`mailto:${customer.email}`}
                  className="inline-flex items-center gap-1.5 hover:text-ink transition truncate"
                >
                  <Mail className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">{customer.email}</span>
                </a>
              ) : (
                <span className="inline-flex items-center gap-1.5 text-ink-muted/60">
                  <Mail className="h-3.5 w-3.5" />
                  {t('customers.no_email')}
                </span>
              )}
              <span className="inline-flex items-center gap-1.5">
                <CalendarClock className="h-3.5 w-3.5" />
                {t('customer_detail.joined', {
                  date: formatTbilisiDate(customer.date_joined, i18n.language),
                })}
              </span>
            </div>
          </div>
        </div>
      </Card>

      <CustomerTotals customer={customer} />
      <NotesCard customer={customer} />
      <BookingHistory customer={customer} />
    </div>
  );
}

function BackLink() {
  const { t } = useTranslation('admin');
  return (
    <Link
      to="/customers"
      className="inline-flex items-center gap-1.5 text-ink-muted hover:text-ink text-sm self-start transition"
    >
      <ArrowLeft className="h-3.5 w-3.5" />
      {t('page.customers')}
    </Link>
  );
}

function CustomerTotals({ customer }: { customer: AdminCustomer }) {
  const { t, i18n } = useTranslation('admin');
  // Envelope count only — one row per page is not needed, but the committed
  // API has no dedicated counter, so page 1's `count` is the no-show total.
  const noShows = useAdminBookingsPage({ customer_phone: customer.phone, status: 'no_show' }, 1);

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      <Stat label={t('customers.col_bookings')} value={customer.booking_count} variant="ink" />
      <Stat
        label={t('customer_detail.stat_no_shows')}
        value={noShows.data ? noShows.data.count : '…'}
        variant={noShows.data && noShows.data.count > 0 ? 'danger' : 'default'}
      />
      <Stat
        label={t('customers.col_spent')}
        value={formatMoney(customer.total_spent ?? 0, i18n.language)}
        variant="accent"
      />
      <Stat
        label={t('customers.col_last_visit')}
        value={
          customer.last_visit_at
            ? formatTbilisiDate(customer.last_visit_at, i18n.language)
            : t('customer_detail.never')
        }
      />
    </div>
  );
}

function NotesCard({ customer }: { customer: AdminCustomer }) {
  const { t } = useTranslation('admin');
  const update = useAdminUpdateCustomer();
  const [notes, setNotes] = useState(customer.notes);

  const dirty = notes !== customer.notes;

  const onSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await update.mutateAsync({ id: customer.id, notes });
    } catch {
      /* surfaced via toast + inline error */
    }
  };

  return (
    <Card>
      <h2 className="font-display text-xl mb-1 tracking-tight">
        {t('customer_detail.notes_title')}
      </h2>
      <p className="text-xs text-ink-muted mb-3">{t('customer_detail.notes_hint')}</p>
      <form onSubmit={onSave} className="flex flex-col gap-3">
        <label className="flex flex-col gap-1.5">
          <span className="sr-only">{t('customer_detail.notes_title')}</span>
          <textarea
            rows={4}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder={t('customer_detail.notes_placeholder')}
            className="px-3.5 py-2.5 bg-surface-2 border border-line rounded-md text-[15px] text-ink placeholder:text-ink-muted/60 focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/15"
          />
        </label>
        <ErrorMessage error={update.error} />
        <Button
          type="submit"
          variant="accent"
          loading={update.isPending}
          disabled={!dirty}
          className="self-end rounded-pill"
        >
          <Save className="h-3.5 w-3.5" />
          {t('customer_detail.notes_save')}
        </Button>
      </form>
    </Card>
  );
}

function BookingHistory({ customer }: { customer: AdminCustomer }) {
  const { t, i18n } = useTranslation('admin');
  const [page, setPage] = usePageState(customer.phone);
  const bookingsQuery = useAdminBookingsPage({ customer_phone: customer.phone }, page);
  const bookings = useMemo(() => bookingsQuery.data?.results ?? [], [bookingsQuery.data]);
  const pages = pageCount(bookingsQuery.data?.count ?? 0);
  const [selected, setSelected] = useState<AdminBooking | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  const openBooking = (b: AdminBooking) => {
    setSelected(b);
    setSheetOpen(true);
  };

  return (
    <Card>
      <h2 className="font-display text-xl mb-4 tracking-tight">
        {t('customer_detail.bookings_title')}
      </h2>
      {bookingsQuery.isError ? (
        <SectionError error={bookingsQuery.error} onRetry={() => bookingsQuery.refetch()} />
      ) : bookingsQuery.isLoading ? (
        <p role="status" aria-live="polite" className="text-ink-muted text-sm">
          {t('actions.loading')}
        </p>
      ) : bookings.length === 0 ? (
        <p className="text-ink-muted text-sm">{t('customer_detail.no_bookings')}</p>
      ) : (
        <div className="overflow-x-auto border border-line rounded-md">
          <table className="w-full text-sm">
            <thead className="border-b border-line bg-bg/50">
              <tr className="text-left text-ink-muted">
                <th
                  scope="col"
                  className="px-3 py-2.5 font-medium text-xs uppercase tracking-[0.1em]"
                >
                  {t('bookings.col_when')}
                </th>
                <th
                  scope="col"
                  className="px-3 py-2.5 font-medium text-xs uppercase tracking-[0.1em]"
                >
                  {t('bookings.col_service')}
                </th>
                <th
                  scope="col"
                  className="px-3 py-2.5 font-medium text-xs uppercase tracking-[0.1em]"
                >
                  {t('bookings.col_barber')}
                </th>
                <th
                  scope="col"
                  className="px-3 py-2.5 font-medium text-xs uppercase tracking-[0.1em] text-right"
                >
                  {t('bookings.col_price')}
                </th>
                <th
                  scope="col"
                  className="px-3 py-2.5 font-medium text-xs uppercase tracking-[0.1em]"
                >
                  {t('bookings.col_status')}
                </th>
              </tr>
            </thead>
            <tbody>
              {bookings.map((b) => {
                const start = new Date(b.start_at);
                return (
                  <tr
                    key={b.id}
                    role="button"
                    tabIndex={0}
                    aria-label={t('bookings.row_open_label', {
                      name: b.customer_name || b.walk_in_name || '—',
                    })}
                    onClick={() => openBooking(b)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        openBooking(b);
                      }
                    }}
                    className="border-b border-line last:border-b-0 hover:bg-bg/40 transition cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent/40"
                  >
                    <td className="px-3 py-2.5 align-middle whitespace-nowrap">
                      <span className="text-ink tabular-nums">
                        {formatTbilisiDate(start, i18n.language)}{' '}
                        {formatTbilisiTime(start)}
                      </span>
                      {b.customer === null && (
                        <span className="ml-2 text-[10px] uppercase tracking-[0.12em] text-ink-muted">
                          {t('bookings.walk_in_tag')}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 align-middle text-ink">
                      {pickLocalized(b.service_name, b.service_name_en, i18n.language)}
                    </td>
                    <td className="px-3 py-2.5 align-middle text-ink-muted">{b.barber_name}</td>
                    <td className="px-3 py-2.5 align-middle text-right font-medium tabular-nums">
                      {formatMoney(b.price_at_booking, i18n.language)}
                    </td>
                    <td className="px-3 py-2.5 align-middle">
                      <Badge variant={STATUS_VARIANTS[b.status]}>{t(`status.${b.status}`)}</Badge>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <Pager page={page} pageCount={pages} onPageChange={setPage} className="mt-4" />

      <BookingDetailSheet booking={selected} open={sheetOpen} onOpenChange={setSheetOpen} />
    </Card>
  );
}
