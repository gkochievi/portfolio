import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Calendar,
  Check,
  CheckCircle2,
  Clock,
  Phone,
  Save,
  Scissors,
  UserMinus,
  UserRound,
  X,
} from 'lucide-react';
import { Sheet, SheetContent, SheetTitle, SheetTitleHidden } from '@/components/Sheet';
import { Button } from '@/components/Button';
import { Badge } from '@/components/Badge';
import { ErrorMessage } from '@/components/ErrorMessage';
import { ConfirmDialog } from './ConfirmDialog';
import { CancelReasonField } from './BookingsTable';
import { AvailabilityCalendar } from './AvailabilityCalendar';
import {
  useAdminAvailability,
  useAdminBookingCancel,
  useAdminBookingComplete,
  useAdminBookingConfirm,
  useAdminBookingNoShow,
  useAdminBookingUpdate,
  type AdminBooking,
} from '../hooks';
import { cn } from '@/lib/cn';
import { formatMoney, formatTbilisiDate, formatTbilisiDateTime, formatTbilisiTime } from '@/lib/datetime';
import { pickLocalized } from '@/lib/localized';

function ymd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

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

interface Props {
  booking: AdminBooking | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type SheetAction = 'confirm_booking' | 'complete' | 'no_show' | 'cancel';

const DIALOG_KEYS: Record<SheetAction, { title: string; body: string; yes: string }> = {
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

export function BookingDetailSheet({ booking, open, onOpenChange }: Props) {
  const { t, i18n } = useTranslation('admin');
  const update = useAdminBookingUpdate();
  const confirmBooking = useAdminBookingConfirm();
  const complete = useAdminBookingComplete();
  const noShow = useAdminBookingNoShow();
  const cancel = useAdminBookingCancel();

  const [notes, setNotes] = useState('');
  const [rescheduleDate, setRescheduleDate] = useState<string>('');
  const [rescheduleSlot, setRescheduleSlot] = useState<string | null>(null);
  const [trackedId, setTrackedId] = useState<number | null>(null);
  const [confirm, setConfirm] = useState<SheetAction | null>(null);
  const [cancelReason, setCancelReason] = useState('');

  // Sync local form state when the opened booking changes.
  if (booking && booking.id !== trackedId) {
    setTrackedId(booking.id);
    setNotes(booking.notes ?? '');
    setRescheduleDate(booking.start_at.slice(0, 10));
    setRescheduleSlot(null);
  }

  const isReschedulable = booking?.status === 'pending' || booking?.status === 'confirmed';

  // Fetch availability for the picked date, using booking's barber + service.
  const availability = useAdminAvailability(
    booking && isReschedulable && rescheduleDate ? booking.barber : null,
    booking && isReschedulable && rescheduleDate ? booking.service : null,
    booking && isReschedulable ? rescheduleDate : null,
  );

  if (!booking) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent closeLabel={t('actions.close')}>
          <SheetTitleHidden>{t('bookings.detail_title')}</SheetTitleHidden>
        </SheetContent>
      </Sheet>
    );
  }

  const start = new Date(booking.start_at);
  const end = new Date(booking.end_at);
  const isOpen = booking.status === 'pending' || booking.status === 'confirmed';
  const error =
    update.error ?? confirmBooking.error ?? complete.error ?? noShow.error ?? cancel.error;
  const mutating =
    confirmBooking.isPending || complete.isPending || noShow.isPending || cancel.isPending;

  const customerName = booking.customer ? booking.customer_name : booking.walk_in_name;
  const customerPhone = booking.customer ? booking.customer_phone : booking.walk_in_phone;

  const onSaveNotes = () => {
    if (notes === booking.notes) return;
    update.mutate({ id: booking.id, notes });
  };

  const onSaveReschedule = () => {
    if (!booking || !rescheduleSlot) return;
    if (rescheduleSlot === booking.start_at) return;
    update.mutate(
      { id: booking.id, start_at: rescheduleSlot },
      { onSuccess: () => setRescheduleSlot(null) },
    );
  };

  // Await the mutation so the confirm dialog shows its loading state; the
  // dialog and sheet only close on success — a failure keeps them open so the
  // receptionist actually sees the error (toast + inline message).
  const runConfirmed = async () => {
    if (!confirm || mutating) return;
    try {
      if (confirm === 'cancel') {
        await cancel.mutateAsync({ id: booking.id, reason: cancelReason });
      } else {
        const mutation =
          confirm === 'confirm_booking'
            ? confirmBooking
            : confirm === 'complete'
              ? complete
              : noShow;
        await mutation.mutateAsync(booking.id);
      }
      setConfirm(null);
      setCancelReason('');
      onOpenChange(false);
    } catch {
      /* surfaced via toast + ErrorMessage */
    }
  };

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent closeLabel={t('actions.close')}>
          <div className="flex flex-col gap-6 mt-2">
            <header>
              <p className="text-xs uppercase tracking-[0.18em] text-accent font-medium mb-2">
                {t('bookings.detail_title')}
              </p>
              <SheetTitle
                asChild
                className="font-display text-3xl text-ink tracking-tight leading-tight mb-2 block"
              >
                <h2>
                  {pickLocalized(booking.service_name, booking.service_name_en, i18n.language)}
                </h2>
              </SheetTitle>
              <Badge variant={STATUS_VARIANTS[booking.status]}>
                {t(`status.${booking.status}`)}
              </Badge>
            </header>

            <div className="flex flex-col gap-3 border-t border-line pt-5">
              <Row icon={<Calendar className="h-4 w-4" />} label={t('bookings.detail_when')}>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium text-ink tabular-nums">
                    {formatTbilisiDate(start)}
                  </span>
                  <span className="text-ink-muted text-sm tabular-nums">
                    {formatTbilisiTime(start)}
                    {' – '}
                    {formatTbilisiTime(end)}
                  </span>
                </div>
              </Row>

              <Row icon={<Scissors className="h-4 w-4" />} label={t('bookings.detail_service')}>
                <span className="text-ink">
                  {pickLocalized(booking.service_name, booking.service_name_en, i18n.language)}
                </span>
                <span className="ml-2 text-ink-muted text-sm">
                  · {formatMoney(booking.price_at_booking, i18n.language)}
                </span>
              </Row>

              <Row icon={<UserRound className="h-4 w-4" />} label={t('bookings.detail_barber')}>
                <span className="text-ink">{booking.barber_name}</span>
              </Row>

              <Row icon={<UserRound className="h-4 w-4" />} label={t('bookings.detail_customer')}>
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-ink">{customerName || '—'}</span>
                    {!booking.customer && (
                      <Badge variant="outline">{t('bookings.walk_in_tag')}</Badge>
                    )}
                  </div>
                  {customerPhone && (
                    <a
                      href={`tel:${customerPhone}`}
                      className="inline-flex items-center gap-1.5 text-sm text-ink-muted hover:text-ink transition"
                    >
                      <Phone className="h-3.5 w-3.5" />
                      {customerPhone}
                    </a>
                  )}
                </div>
              </Row>

              <Row icon={<Clock className="h-4 w-4" />} label={t('bookings.detail_created')}>
                <span className="text-ink-muted text-sm tabular-nums">
                  {formatTbilisiDateTime(booking.created_at)}
                </span>
              </Row>

              {booking.cancellation_reason && (
                <Row
                  icon={<X className="h-4 w-4" />}
                  label={t('bookings.detail_cancellation_reason')}
                >
                  <span className="text-ink">{booking.cancellation_reason}</span>
                </Row>
              )}
            </div>

            {/* Notes */}
            <div className="flex flex-col gap-2 border-t border-line pt-5">
              <span className="text-xs uppercase tracking-[0.12em] text-ink-muted font-medium">
                {t('bookings.detail_notes')}
              </span>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                placeholder={t('bookings.detail_notes_empty')}
                className={cn(
                  'px-3.5 py-2.5 bg-surface-2 border border-line rounded-md text-[15px] text-ink',
                  'placeholder:text-ink-muted/60',
                  'focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/15 transition',
                )}
              />
              <Button
                size="sm"
                variant="ghost"
                disabled={notes === booking.notes}
                onClick={onSaveNotes}
                loading={update.isPending && update.variables?.notes !== undefined}
                className="self-start rounded-pill"
              >
                <Save className="h-3.5 w-3.5" />
                {t('bookings.save_notes')}
              </Button>
            </div>

            {/* Reschedule via availability calendar + slot picker */}
            {isOpen && (
              <div className="flex flex-col gap-3 border-t border-line pt-5">
                <span className="text-xs uppercase tracking-[0.12em] text-ink-muted font-medium">
                  {t('bookings.reschedule')}
                </span>
                <p className="text-sm text-ink-muted">{t('bookings.reschedule_pick_slot')}</p>
                <AvailabilityCalendar
                  barberId={booking.barber}
                  serviceId={booking.service}
                  selected={rescheduleDate ? new Date(rescheduleDate + 'T12:00:00') : undefined}
                  onSelect={(d) => {
                    setRescheduleDate(d ? ymd(d) : '');
                    setRescheduleSlot(null);
                  }}
                />
                {availability.data && availability.data.slots.length > 0 ? (
                  <div className="grid grid-cols-3 gap-2">
                    {availability.data.slots.map((s) => {
                      const time = formatTbilisiTime(s.start_at);
                      const selected = rescheduleSlot === s.start_at;
                      const isCurrent = s.start_at === booking.start_at;
                      return (
                        <button
                          key={s.start_at}
                          type="button"
                          onClick={() => setRescheduleSlot(s.start_at)}
                          className={cn(
                            'px-3 py-2 rounded-md border text-sm font-medium tabular-nums transition',
                            selected
                              ? 'bg-ink text-bg border-ink'
                              : isCurrent
                                ? 'bg-accent-soft text-ink border-accent'
                                : 'bg-surface text-ink border-line hover:border-line-strong',
                          )}
                        >
                          {time}
                        </button>
                      );
                    })}
                  </div>
                ) : availability.isLoading ? (
                  <p role="status" aria-live="polite" className="text-sm text-ink-muted">
                    {t('actions.loading')}
                  </p>
                ) : rescheduleDate ? (
                  <p className="text-sm text-ink-muted">{t('walk_in_page.no_slots')}</p>
                ) : null}
                <Button
                  size="sm"
                  variant="primary"
                  disabled={!rescheduleSlot || rescheduleSlot === booking.start_at}
                  onClick={onSaveReschedule}
                  loading={update.isPending && update.variables?.start_at !== undefined}
                  className="self-start rounded-pill"
                >
                  <Calendar className="h-3.5 w-3.5" />
                  {t('bookings.reschedule_save')}
                </Button>
              </div>
            )}

            <ErrorMessage error={error} />

            {isOpen && (
              <div className="border-t border-line pt-5 flex flex-col gap-2">
                {booking.status === 'pending' && (
                  <Button
                    variant="accent"
                    className="rounded-pill"
                    onClick={() => setConfirm('confirm_booking')}
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    {t('bookings.row_confirm')}
                  </Button>
                )}
                <Button
                  variant="primary"
                  className="rounded-pill"
                  onClick={() => setConfirm('complete')}
                >
                  <Check className="h-4 w-4" />
                  {t('bookings.row_complete')}
                </Button>
                <Button
                  variant="secondary"
                  className="rounded-pill"
                  onClick={() => setConfirm('no_show')}
                >
                  <UserMinus className="h-4 w-4" />
                  {t('bookings.row_no_show')}
                </Button>
                <Button
                  variant="danger"
                  className="rounded-pill"
                  onClick={() => setConfirm('cancel')}
                >
                  <X className="h-4 w-4" />
                  {t('bookings.row_cancel')}
                </Button>
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>

      <ConfirmDialog
        open={confirm !== null}
        onOpenChange={(o) => {
          if (!o && !mutating) {
            setConfirm(null);
            setCancelReason('');
          }
        }}
        title={confirm ? t(`bookings.${DIALOG_KEYS[confirm].title}`) : ''}
        body={confirm ? t(`bookings.${DIALOG_KEYS[confirm].body}`) : ''}
        confirmLabel={confirm ? t(`bookings.${DIALOG_KEYS[confirm].yes}`) : ''}
        cancelLabel={t('actions.cancel')}
        destructive={confirm === 'cancel' || confirm === 'no_show'}
        loading={mutating}
        onConfirm={runConfirmed}
      >
        {confirm === 'cancel' && (
          <CancelReasonField value={cancelReason} onChange={setCancelReason} disabled={mutating} />
        )}
      </ConfirmDialog>
    </>
  );
}

function Row({
  icon,
  label,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-3">
      <span className="inline-flex items-center justify-center w-8 h-8 rounded-pill bg-line/60 text-ink-muted shrink-0 mt-0.5">
        {icon}
      </span>
      <div className="flex-1 min-w-0">
        <div className="text-[10px] uppercase tracking-[0.12em] font-medium text-ink-muted">
          {label}
        </div>
        <div className="mt-0.5">{children}</div>
      </div>
    </div>
  );
}
