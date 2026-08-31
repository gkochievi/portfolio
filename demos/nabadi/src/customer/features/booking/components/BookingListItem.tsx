import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Calendar, Clock, Scissors, UserRound } from 'lucide-react';
import { Button } from '@/components/Button';
import { Badge } from '@/components/Badge';
import { ErrorMessage } from '@/components/ErrorMessage';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/Dialog';
import { ApiError } from '@/lib/api';
import { cn } from '@/lib/cn';
import { pickLocalized } from '@/lib/localized';
import { formatMoney, formatTbilisiDate, formatTbilisiTime } from '@/lib/datetime';
import { SERVICE_ICONS } from '@/lib/serviceIcons';
import type { BookingItem } from '../hooks';
import { useCancelBooking } from '../hooks';

const STATUS_VARIANTS: Record<
  BookingItem['status'],
  'default' | 'accent' | 'success' | 'danger' | 'ink'
> = {
  pending: 'accent',
  confirmed: 'ink',
  completed: 'success',
  cancelled: 'danger',
  no_show: 'default',
};

function ServiceVisual({ booking, className }: { booking: BookingItem; className?: string }) {
  if (booking.service_image) {
    return (
      <div className={cn('overflow-hidden bg-bg', className)}>
        <img
          src={booking.service_image}
          alt=""
          className="w-full h-full object-cover photo-warm"
          loading="lazy"
        />
      </div>
    );
  }
  if (booking.service_icon_key) {
    const def = SERVICE_ICONS.find((i) => i.key === booking.service_icon_key);
    if (def) {
      const Icon = def.Icon;
      return (
        // Accent-soft is never a large fill — icon carries the accent instead.
        <div
          className={cn(
            'bg-bg border border-line text-accent flex items-center justify-center',
            className,
          )}
        >
          <Icon className="h-7 w-7" />
        </div>
      );
    }
  }
  return (
    <div className={cn('bg-line/40 text-ink-muted flex items-center justify-center', className)}>
      <Scissors className="h-5 w-5" />
    </div>
  );
}

export function BookingListItem({ booking }: { booking: BookingItem }) {
  const { t, i18n } = useTranslation('profile');
  const { t: tStatus } = useTranslation('book');
  const cancel = useCancelBooking();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const serviceName = pickLocalized(booking.service_name, booking.service_name_en, i18n.language);

  // Mirror the cancellation window client-side where the payload allows it
  // (newer backends expose can_cancel / cancellable_until); otherwise learn
  // it from the server's cancellation_window_passed error and stop offering
  // the button instead of looping the user through a failing confirm.
  const windowPassed =
    booking.can_cancel === false ||
    (booking.cancellable_until != null && new Date(booking.cancellable_until) <= new Date()) ||
    (cancel.error instanceof ApiError && cancel.error.code === 'cancellation_window_passed');
  const cancellableStatus = booking.status === 'pending' || booking.status === 'confirmed';
  const canCancel = cancellableStatus && !windowPassed;

  const dateLabel = formatTbilisiDate(booking.start_at, i18n.language);
  const timeLabel = formatTbilisiTime(booking.start_at, i18n.language);

  const onConfirmCancel = () => {
    cancel.mutate(booking.id, {
      onSuccess: () => setConfirmOpen(false),
    });
  };

  return (
    <article className="bg-surface border border-line rounded-2xl p-5 flex gap-4">
      <ServiceVisual booking={booking} className="w-16 h-16 sm:w-20 sm:h-20 rounded-md shrink-0" />

      <div className="flex-1 min-w-0 flex flex-col gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          <h3 className="font-display text-lg sm:text-xl text-ink leading-tight tracking-tight">
            {serviceName}
          </h3>
          <Badge variant={STATUS_VARIANTS[booking.status]}>
            {tStatus(`booking_status_${booking.status}`, {
              defaultValue: booking.status,
            })}
          </Badge>
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-ink-muted">
          <span className="inline-flex items-center gap-1.5 tabular-nums">
            <Calendar className="h-3.5 w-3.5" />
            {dateLabel}
          </span>
          <span className="inline-flex items-center gap-1.5 tabular-nums">
            <Clock className="h-3.5 w-3.5" />
            {timeLabel}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <UserRound className="h-3.5 w-3.5" />
            {booking.barber_name}
          </span>
          <span className="font-medium text-ink tabular-nums">
            {formatMoney(booking.price_at_booking, i18n.language)}
          </span>
        </div>
      </div>

      {canCancel && (
        <div className="flex flex-col gap-1 items-end shrink-0">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setConfirmOpen(true)}
            className="rounded-pill text-ink-muted hover:text-danger"
          >
            {t('cancel_booking')}
          </Button>
        </div>
      )}
      {cancellableStatus && windowPassed && (
        <p className="text-xs text-ink-muted max-w-[12rem] text-right self-center shrink-0">
          {t('cancel_window_closed')}
        </p>
      )}

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('confirm_cancel')}</DialogTitle>
            <DialogDescription>
              {t('confirm_cancel_body', { service: serviceName, date: dateLabel, time: timeLabel })}
            </DialogDescription>
          </DialogHeader>
          <ErrorMessage error={cancel.error} />
          <DialogFooter>
            <Button
              variant="secondary"
              className="rounded-pill"
              onClick={() => setConfirmOpen(false)}
              disabled={cancel.isPending}
            >
              {t('keep_booking')}
            </Button>
            <Button
              variant="danger"
              className="rounded-pill"
              onClick={onConfirmCancel}
              loading={cancel.isPending}
            >
              {t('cancel_booking')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </article>
  );
}
