import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Check, CheckCircle2, MoreHorizontal, UserMinus, X } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/DropdownMenu';
import { Badge } from '@/components/Badge';
import { ErrorMessage } from '@/components/ErrorMessage';
import { ConfirmDialog } from './ConfirmDialog';
import {
  useAdminBookingCancel,
  useAdminBookingComplete,
  useAdminBookingConfirm,
  useAdminBookingNoShow,
  type AdminBooking,
} from '../hooks';
import { cn } from '@/lib/cn';
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

function customerLabel(b: AdminBooking) {
  return b.customer ? b.customer_name : b.walk_in_name;
}

function customerInitial(b: AdminBooking) {
  const name = customerLabel(b);
  return name?.trim()[0]?.toUpperCase() ?? '?';
}

function customerPhone(b: AdminBooking) {
  return b.customer ? b.customer_phone : b.walk_in_phone;
}

interface Props {
  bookings: AdminBooking[];
  onRowClick: (id: number) => void;
}

export type BookingActionKind = 'confirm_booking' | 'complete' | 'no_show' | 'cancel';
type ConfirmAction = { id: number; kind: BookingActionKind } | null;

export function BookingsTable({ bookings, onRowClick }: Props) {
  const { t, i18n } = useTranslation('admin');
  const confirmBooking = useAdminBookingConfirm();
  const complete = useAdminBookingComplete();
  const noShow = useAdminBookingNoShow();
  const cancel = useAdminBookingCancel();
  const [confirm, setConfirm] = useState<ConfirmAction>(null);
  const [cancelReason, setCancelReason] = useState('');
  const error = confirmBooking.error ?? complete.error ?? noShow.error ?? cancel.error;
  const mutating =
    confirmBooking.isPending || complete.isPending || noShow.isPending || cancel.isPending;

  const closeConfirm = () => {
    setConfirm(null);
    setCancelReason('');
  };

  // Await the mutation so the dialog can show its loading state; only close on
  // success — a failure keeps it open (error surfaces via toast + inline).
  const runConfirmed = async () => {
    if (!confirm || mutating) return;
    try {
      if (confirm.kind === 'cancel') {
        await cancel.mutateAsync({ id: confirm.id, reason: cancelReason });
      } else {
        const mutation =
          confirm.kind === 'confirm_booking'
            ? confirmBooking
            : confirm.kind === 'complete'
              ? complete
              : noShow;
        await mutation.mutateAsync(confirm.id);
      }
      closeConfirm();
    } catch {
      /* surfaced via toast + ErrorMessage */
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <ErrorMessage error={error} />

      {/* Mobile cards */}
      <div className="md:hidden flex flex-col gap-3">
        {bookings.map((b) => (
          <BookingCard
            key={b.id}
            booking={b}
            onOpen={onRowClick}
            onAct={(kind) => setConfirm({ id: b.id, kind })}
          />
        ))}
      </div>

      {/* Desktop table */}
      <div className="hidden md:block overflow-x-auto border border-line rounded-2xl bg-surface">
        <table className="w-full text-sm">
          <thead className="border-b border-line bg-bg/50">
            <tr className="text-left text-ink-muted">
              <th scope="col" className="px-4 py-3 font-medium text-xs uppercase tracking-[0.1em]">
                {t('bookings.col_when')}
              </th>
              <th scope="col" className="px-4 py-3 font-medium text-xs uppercase tracking-[0.1em]">
                {t('bookings.col_customer')}
              </th>
              <th scope="col" className="px-4 py-3 font-medium text-xs uppercase tracking-[0.1em]">
                {t('bookings.col_barber')}
              </th>
              <th scope="col" className="px-4 py-3 font-medium text-xs uppercase tracking-[0.1em]">
                {t('bookings.col_service')}
              </th>
              <th
                scope="col"
                className="px-4 py-3 font-medium text-xs uppercase tracking-[0.1em] text-right"
              >
                {t('bookings.col_price')}
              </th>
              <th scope="col" className="px-4 py-3 font-medium text-xs uppercase tracking-[0.1em]">
                {t('bookings.col_status')}
              </th>
              <th scope="col" className="px-4 py-3 w-12">
                <span className="sr-only">{t('bookings.col_actions_label')}</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {bookings.map((b) => {
              const start = new Date(b.start_at);
              const isOpen = b.status === 'pending' || b.status === 'confirmed';
              return (
                <tr
                  key={b.id}
                  role="button"
                  tabIndex={0}
                  aria-label={t('bookings.row_open_label', {
                    name: customerLabel(b) || '—',
                  })}
                  className="border-b border-line last:border-b-0 hover:bg-bg/40 transition cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent/40"
                  onClick={() => onRowClick(b.id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      onRowClick(b.id);
                    }
                  }}
                >
                  <td className="px-4 py-3 align-middle">
                    <div className="flex flex-col leading-tight">
                      <span className="text-ink font-medium tabular-nums">
                        {formatTbilisiDate(start)}
                      </span>
                      <span className="text-ink-muted text-xs tabular-nums">
                        {formatTbilisiTime(start)}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3 align-middle">
                    <div className="flex items-center gap-3">
                      <span
                        className={cn(
                          'inline-flex items-center justify-center w-9 h-9 rounded-pill font-medium text-sm shrink-0',
                          b.customer ? 'bg-ink text-bg' : 'bg-line text-ink-muted',
                        )}
                        aria-hidden
                      >
                        {customerInitial(b)}
                      </span>
                      <div className="min-w-0">
                        <div className="text-ink font-medium truncate flex items-center gap-2">
                          {customerLabel(b) || '—'}
                          {!b.customer && (
                            <Badge variant="outline" className="text-[10px]">
                              {t('bookings.walk_in_tag')}
                            </Badge>
                          )}
                        </div>
                        {customerPhone(b) && (
                          <div className="text-xs text-ink-muted truncate">{customerPhone(b)}</div>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 align-middle text-ink">{b.barber_name}</td>
                  <td className="px-4 py-3 align-middle text-ink">
                    {pickLocalized(b.service_name, b.service_name_en, i18n.language)}
                  </td>
                  <td className="px-4 py-3 align-middle text-right font-medium tabular-nums">
                    {formatMoney(b.price_at_booking, i18n.language)}
                  </td>
                  <td className="px-4 py-3 align-middle">
                    <Badge variant={STATUS_VARIANTS[b.status]}>{t(`status.${b.status}`)}</Badge>
                  </td>
                  <td className="px-4 py-3 align-middle">
                    <div onClick={(e) => e.stopPropagation()}>
                      <RowMenu
                        isOpen={isOpen}
                        isPending={b.status === 'pending'}
                        onView={() => onRowClick(b.id)}
                        onAct={(kind) => setConfirm({ id: b.id, kind })}
                      />
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <ConfirmDialog
        open={confirm !== null}
        onOpenChange={(open) => !open && !mutating && closeConfirm()}
        title={confirm ? t(`bookings.${DIALOG_KEYS[confirm.kind].title}`) : ''}
        body={confirm ? t(`bookings.${DIALOG_KEYS[confirm.kind].body}`) : ''}
        confirmLabel={confirm ? t(`bookings.${DIALOG_KEYS[confirm.kind].yes}`) : ''}
        cancelLabel={t('actions.cancel')}
        destructive={confirm?.kind === 'cancel' || confirm?.kind === 'no_show'}
        loading={mutating}
        onConfirm={runConfirmed}
      >
        {confirm?.kind === 'cancel' && (
          <CancelReasonField value={cancelReason} onChange={setCancelReason} disabled={mutating} />
        )}
      </ConfirmDialog>
    </div>
  );
}

/** Optional cancellation-reason input shown inside the cancel confirm dialog. */
export function CancelReasonField({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  const { t } = useTranslation('admin');
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-sm font-medium text-ink">{t('bookings.cancel_reason_label')}</span>
      <textarea
        rows={2}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className={cn(
          'px-3.5 py-2.5 bg-surface-2 border border-line rounded-md text-[15px] text-ink',
          'focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/15 transition',
          'disabled:opacity-50',
        )}
      />
    </label>
  );
}

const DIALOG_KEYS: Record<BookingActionKind, { title: string; body: string; yes: string }> = {
  confirm_booking: {
    title: 'confirm_confirm_title',
    body: 'confirm_confirm_body',
    yes: 'yes_confirm',
  },
  complete: {
    title: 'confirm_complete_title',
    body: 'confirm_complete_body',
    yes: 'yes_complete',
  },
  no_show: {
    title: 'confirm_no_show_title',
    body: 'confirm_no_show_body',
    yes: 'yes_no_show',
  },
  cancel: {
    title: 'confirm_cancel_title',
    body: 'confirm_cancel_body',
    yes: 'yes_cancel',
  },
};

function BookingCard({
  booking,
  onOpen,
  onAct,
}: {
  booking: AdminBooking;
  onOpen: (id: number) => void;
  onAct: (kind: BookingActionKind) => void;
}) {
  const { t, i18n } = useTranslation('admin');
  const start = new Date(booking.start_at);
  const isOpen = booking.status === 'pending' || booking.status === 'confirmed';
  // Use a div with role=button rather than a real <button>: the card body
  // contains a dropdown menu trigger (also a <button>), and nesting buttons
  // is invalid HTML.
  const onActivate = () => onOpen(booking.id);
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onActivate}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onActivate();
        }
      }}
      className="text-left bg-surface border border-line rounded-2xl p-4 flex flex-col gap-2 hover:border-line-strong transition cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex flex-col leading-tight">
          <span className="font-medium text-ink tabular-nums">{formatTbilisiDate(start)}</span>
          <span className="text-xs text-ink-muted tabular-nums">
            {formatTbilisiTime(start)} ·{' '}
            {pickLocalized(booking.service_name, booking.service_name_en, i18n.language)}
          </span>
        </div>
        <Badge variant={STATUS_VARIANTS[booking.status]}>{t(`status.${booking.status}`)}</Badge>
      </div>
      <div className="flex items-center gap-3 mt-1">
        <span
          className={cn(
            'inline-flex items-center justify-center w-9 h-9 rounded-pill font-medium text-sm shrink-0',
            booking.customer ? 'bg-ink text-bg' : 'bg-line text-ink-muted',
          )}
        >
          {customerInitial(booking)}
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-sm text-ink font-medium truncate">
            {customerLabel(booking) || '—'}
            {!booking.customer && (
              <span className="ml-2 text-[10px] uppercase tracking-wider text-ink-muted">
                {t('bookings.walk_in_tag')}
              </span>
            )}
          </div>
          <div className="text-xs text-ink-muted truncate">
            {booking.barber_name} · {formatMoney(booking.price_at_booking, i18n.language)}
          </div>
        </div>
        {isOpen && (
          <div onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
            <RowMenu
              isOpen={isOpen}
              isPending={booking.status === 'pending'}
              onView={() => onOpen(booking.id)}
              onAct={onAct}
            />
          </div>
        )}
      </div>
    </div>
  );
}

function RowMenu({
  isOpen,
  isPending,
  onView,
  onAct,
}: {
  isOpen: boolean;
  isPending: boolean;
  onView: () => void;
  onAct: (kind: BookingActionKind) => void;
}) {
  const { t } = useTranslation('admin');
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="inline-flex items-center justify-center w-9 h-9 rounded-pill text-ink-muted hover:bg-line/60 hover:text-ink transition"
          aria-label={t('actions.row_actions_label')}
        >
          <MoreHorizontal className="h-4 w-4" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuItem onSelect={onView}>{t('bookings.row_view')}</DropdownMenuItem>
        {isOpen && (
          <>
            <DropdownMenuSeparator />
            {isPending && (
              <DropdownMenuItem onSelect={() => onAct('confirm_booking')}>
                <CheckCircle2 className="h-4 w-4" />
                {t('bookings.row_confirm')}
              </DropdownMenuItem>
            )}
            <DropdownMenuItem onSelect={() => onAct('complete')}>
              <Check className="h-4 w-4" />
              {t('bookings.row_complete')}
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => onAct('no_show')}>
              <UserMinus className="h-4 w-4" />
              {t('bookings.row_no_show')}
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => onAct('cancel')} destructive>
              <X className="h-4 w-4" />
              {t('bookings.row_cancel')}
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
