import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, ArrowRight, Calendar, Check, Scissors, User, UserRound } from 'lucide-react';
import { Layout } from '@/components/Layout';
import { Container } from '@/components/Container';
import { Button } from '@/components/Button';
import { ErrorMessage } from '@/components/ErrorMessage';
import { Input } from '@/components/Input';
import { SectionError } from '@/components/SectionError';
import { Skeleton, SkeletonGrid } from '@/components/Skeleton';
import { ServiceCard } from '@/features/booking/components/ServiceCard';
import { BarberCard } from '@/features/booking/components/BarberCard';
import { SlotButton } from '@/features/booking/components/SlotButton';
import { AvailabilityCalendar } from '@/features/booking/components/AvailabilityCalendar';
import {
  useAvailability,
  useBarbers,
  useCreateBooking,
  useServices,
  type AvailabilitySlot,
} from '@/features/booking/hooks';
import { isDuplicateActiveBooking, isSlotTaken } from '@/features/booking/errors';
import { useBookingWizard } from '@/features/booking/store';
import { useMe } from '@/auth/hooks';
import { pickLocalized } from '@/lib/localized';
import {
  formatMoney,
  formatTbilisiDate,
  formatTbilisiTime,
  tbilisiHour,
  todayTbilisiYmd,
} from '@/lib/datetime';
import { cn } from '@/lib/cn';

export function Book() {
  const { t } = useTranslation('book');
  const wizard = useBookingWizard();
  const me = useMe();
  const [search] = useSearchParams();

  // Allow ?barber=N to preselect from a profile/landing card. With no service
  // chosen yet the store pins the barber and lands on the service step.
  const { data: barbers } = useBarbers();
  useEffect(() => {
    const id = search.get('barber');
    if (id && !wizard.barber && barbers) {
      const b = barbers.barbers.find((bb) => bb.id === Number(id));
      if (b) {
        wizard.setBarber(
          { id: b.id, first_name: b.first_name, last_name: b.last_name },
          b.services,
        );
      }
    }
  }, [search, barbers, wizard]);

  return (
    <Layout>
      <Container size="xl" className="py-12 md:py-16">
        <header className="mb-10 max-w-2xl">
          <p className="text-xs uppercase tracking-[0.2em] text-accent mb-3">{t('title')}</p>
          <h1 className="font-display text-4xl md:text-5xl text-ink leading-tight tracking-tight">
            {t('title')}
          </h1>
        </header>

        <Stepper step={wizard.step} />

        <div className="mt-10 grid lg:grid-cols-[1fr_360px] gap-10">
          <div>
            {wizard.step === 0 && <StepService />}
            {wizard.step === 1 && <StepBarber />}
            {wizard.step === 2 && <StepDateTime />}
            {wizard.step === 3 && (
              <StepConfirm authed={Boolean(me.data)} authResolved={!me.isPending} />
            )}
          </div>
          <Summary />
        </div>
      </Container>
    </Layout>
  );
}

function Stepper({ step }: { step: number }) {
  const { t } = useTranslation('book');
  const labels = [
    { label: t('step_service'), icon: Scissors },
    { label: t('step_barber'), icon: User },
    { label: t('step_datetime'), icon: Calendar },
    { label: t('step_confirm'), icon: Check },
  ];
  return (
    <ol className="flex items-center gap-3 md:gap-6 overflow-x-auto pb-2">
      {labels.map((l, i) => {
        const Icon = l.icon;
        const active = i === step;
        const done = i < step;
        return (
          <li
            key={l.label}
            aria-current={active ? 'step' : undefined}
            className="flex items-center gap-2 md:gap-3 shrink-0"
          >
            <span
              className={cn(
                'h-9 w-9 rounded-pill border flex items-center justify-center transition',
                done && 'bg-ink text-bg border-ink',
                active && 'border-accent text-accent',
                !active && !done && 'border-line text-ink-muted',
              )}
            >
              {done ? <Check className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
            </span>
            <span
              className={cn(
                'text-xs md:text-sm uppercase tracking-wider',
                active ? 'text-ink' : 'text-ink-muted',
              )}
            >
              {l.label}
            </span>
            {i < labels.length - 1 && (
              <span className={cn('hidden md:block h-px w-8', done ? 'bg-ink' : 'bg-line')} />
            )}
          </li>
        );
      })}
    </ol>
  );
}

function StepService() {
  const { t, i18n } = useTranslation('book');
  const wizard = useBookingWizard();
  const { data, isLoading, isError, error, refetch } = useServices(wizard.barber?.id ?? null);
  return (
    <section className="flex flex-col gap-8">
      <h2 className="font-display text-2xl md:text-3xl text-ink tracking-tight">
        {t('choose_service')}
      </h2>

      {/* Barber-first entry: the pinned barber filters this list — say so. */}
      {wizard.barber && (
        <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-line bg-surface px-4 py-3">
          <UserRound className="h-4 w-4 text-accent shrink-0" aria-hidden />
          <p className="text-sm text-ink flex-1 min-w-0">
            {t('pinned_barber', {
              name: `${wizard.barber.first_name} ${wizard.barber.last_name}`,
            })}
          </p>
          <Button
            variant="ghost"
            size="sm"
            className="rounded-pill"
            onClick={() => wizard.clearBarber()}
          >
            {t('pinned_barber_clear')}
          </Button>
        </div>
      )}

      {isLoading && <SkeletonGrid count={4} className="lg:grid-cols-2" itemClassName="h-28" />}
      {isError && <SectionError error={error} onRetry={() => refetch()} />}
      {/* Empty catalog — with a pinned barber this otherwise dead-ends, so
          offer the same way out as the banner: unpin and see everyone. */}
      {data && data.categories.every((c) => c.services.length === 0) && (
        <div className="flex flex-col items-start gap-3">
          <p className="text-ink-muted text-sm">{t('no_services')}</p>
          {wizard.barber && (
            <Button
              variant="secondary"
              size="sm"
              className="rounded-pill"
              onClick={() => wizard.clearBarber()}
            >
              {t('pinned_barber_clear')}
            </Button>
          )}
        </div>
      )}
      {data?.categories.map((cat) => (
        <div key={cat.id} className="flex flex-col gap-3">
          <h3 className="text-xs uppercase tracking-[0.2em] text-accent">
            {pickLocalized(cat.name, cat.name_en, i18n.language)}
          </h3>
          <div className="grid sm:grid-cols-2 gap-3">
            {cat.services.map((s) => (
              <ServiceCard
                key={s.id}
                service={s}
                selected={wizard.service?.id === s.id}
                onChoose={() =>
                  wizard.setService({
                    id: s.id,
                    name: s.name,
                    name_en: s.name_en,
                    duration_minutes: s.duration_minutes,
                    price: s.price,
                  })
                }
              />
            ))}
          </div>
        </div>
      ))}
    </section>
  );
}

function StepBarber() {
  const { t } = useTranslation('book');
  const wizard = useBookingWizard();
  const { data, isLoading, isError, error, refetch } = useBarbers();
  const offering = data?.barbers.filter((b) =>
    wizard.service ? b.services.some((s) => s.id === wizard.service?.id) : true,
  );
  return (
    <section className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-2xl md:text-3xl text-ink tracking-tight">
          {t('choose_barber')}
        </h2>
        <Button
          variant="ghost"
          size="sm"
          className="rounded-pill"
          onClick={() => wizard.setStep(0)}
        >
          <ArrowLeft className="h-4 w-4" />
          {t('step_service')}
        </Button>
      </div>
      {isLoading && (
        <div role="status" aria-live="polite" aria-busy="true" className="flex flex-col gap-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-24" />
          ))}
          <span className="sr-only">{t('loading_barbers')}</span>
        </div>
      )}
      {isError && <SectionError error={error} onRetry={() => refetch()} />}
      <div className="flex flex-col gap-3">
        {offering?.map((b) => (
          <BarberCard
            key={b.id}
            barber={b}
            selected={wizard.barber?.id === b.id}
            onChoose={() =>
              wizard.setBarber(
                { id: b.id, first_name: b.first_name, last_name: b.last_name },
                b.services,
              )
            }
          />
        ))}
        {offering && offering.length === 0 && (
          <p className="text-ink-muted text-sm">{t('no_barbers_for_service')}</p>
        )}
      </div>
    </section>
  );
}

function ymdLocal(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function groupSlots(slots: AvailabilitySlot[]) {
  const morning: AvailabilitySlot[] = [];
  const afternoon: AvailabilitySlot[] = [];
  const evening: AvailabilitySlot[] = [];
  for (const s of slots) {
    // Group by the shop's wall clock, not the visitor's device timezone.
    const h = tbilisiHour(s.start_at);
    if (h < 12) morning.push(s);
    else if (h < 17) afternoon.push(s);
    else evening.push(s);
  }
  return { morning, afternoon, evening };
}

function StepDateTime() {
  const { t } = useTranslation('book');
  const wizard = useBookingWizard();
  const todayStr = todayTbilisiYmd();
  const date = wizard.date ?? todayStr;
  const { data, isLoading, isError, error, refetch } = useAvailability(
    wizard.barber?.id ?? null,
    wizard.service?.id ?? null,
    date,
  );

  // Defensive: this step needs both selections. Normally unreachable (the
  // store pins barber-first entries onto the service step), but persisted or
  // hand-rolled states shouldn't dead-end on a blank panel.
  if (!wizard.service || !wizard.barber) {
    return (
      <section className="flex flex-col gap-4">
        <p className="text-ink-muted">{t('complete_previous')}</p>
        <Button
          variant="secondary"
          size="sm"
          className="rounded-pill self-start"
          onClick={() => wizard.setStep(wizard.service ? 1 : 0)}
        >
          <ArrowLeft className="h-4 w-4" />
          {wizard.service ? t('step_barber') : t('step_service')}
        </Button>
      </section>
    );
  }

  const grouped = data ? groupSlots(data.slots) : null;

  return (
    <section className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-2xl md:text-3xl text-ink tracking-tight">
          {t('pick_datetime')}
        </h2>
        <Button
          variant="ghost"
          size="sm"
          className="rounded-pill"
          onClick={() => wizard.setStep(1)}
        >
          <ArrowLeft className="h-4 w-4" />
          {t('step_barber')}
        </Button>
      </div>

      {/* 409 slot_taken recovery lands here with a fresh availability fetch. */}
      {wizard.notice === 'slot_taken' && (
        <div
          role="alert"
          className="rounded-md border border-danger/40 bg-danger/5 px-4 py-3 text-sm text-danger"
        >
          {t('slot_taken_notice')}
        </div>
      )}

      <div className="grid md:grid-cols-[auto_1fr] gap-6 items-start">
        {/* Calendar */}
        <div className="bg-surface border border-line rounded-2xl p-5 md:w-[340px]">
          <AvailabilityCalendar
            barberId={wizard.barber?.id ?? null}
            serviceId={wizard.service?.id ?? null}
            selected={date ? new Date(date + 'T12:00:00') : undefined}
            onSelect={(d) => wizard.setDate(d ? ymdLocal(d) : todayStr)}
          />
        </div>

        {/* Slot picker — grouped by time of day (Tbilisi wall time) */}
        <div className="bg-surface border border-line rounded-2xl p-5 flex flex-col gap-4 min-h-[280px]">
          {isLoading ? (
            <div
              role="status"
              aria-live="polite"
              aria-busy="true"
              className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2"
            >
              {Array.from({ length: 10 }).map((_, i) => (
                <Skeleton key={i} className="h-9 rounded-md" />
              ))}
              <span className="sr-only">{t('loading_slots')}</span>
            </div>
          ) : isError ? (
            <SectionError error={error} onRetry={() => refetch()} />
          ) : data && data.slots.length === 0 ? (
            <p className="text-ink-muted text-sm">{t('no_slots')}</p>
          ) : grouped ? (
            <>
              <SlotGroup
                title={t('time_of_day_morning')}
                slots={grouped.morning}
                selectedAt={wizard.startAt}
                onPick={(s) => wizard.setDateTime(date, s.start_at, s.end_at)}
              />
              <SlotGroup
                title={t('time_of_day_afternoon')}
                slots={grouped.afternoon}
                selectedAt={wizard.startAt}
                onPick={(s) => wizard.setDateTime(date, s.start_at, s.end_at)}
              />
              <SlotGroup
                title={t('time_of_day_evening')}
                slots={grouped.evening}
                selectedAt={wizard.startAt}
                onPick={(s) => wizard.setDateTime(date, s.start_at, s.end_at)}
              />
            </>
          ) : null}
        </div>
      </div>
    </section>
  );
}

function SlotGroup({
  title,
  slots,
  selectedAt,
  onPick,
}: {
  title: string;
  slots: AvailabilitySlot[];
  selectedAt: string | null;
  onPick: (s: AvailabilitySlot) => void;
}) {
  if (slots.length === 0) return null;
  return (
    <div className="flex flex-col gap-2">
      <p className="text-[11px] uppercase tracking-[0.15em] text-ink-muted font-medium">{title}</p>
      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2">
        {slots.map((s) => (
          <SlotButton
            key={s.start_at}
            startAt={s.start_at}
            selected={selectedAt === s.start_at}
            onClick={() => onPick(s)}
          />
        ))}
      </div>
    </div>
  );
}

function StepConfirm({ authed, authResolved }: { authed: boolean; authResolved: boolean }) {
  const { t } = useTranslation('book');
  const { t: tErrors } = useTranslation('errors');
  const wizard = useBookingWizard();
  const create = useCreateBooking();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [promoCode, setPromoCode] = useState('');

  useEffect(() => {
    // Only redirect once we know for sure the user is not signed in.
    if (authResolved && !authed) navigate('/login?next=/book', { replace: true });
  }, [authed, authResolved, navigate]);

  const onConfirm = async () => {
    if (!wizard.service || !wizard.barber || !wizard.startAt) return;
    try {
      await create.mutateAsync({
        barber_id: wizard.barber.id,
        service_id: wizard.service.id,
        start_at: wizard.startAt,
        notes: wizard.notes || undefined,
        promo_code: promoCode.trim() || undefined,
      });
      wizard.reset();
      navigate('/profile?booked=1');
    } catch (e) {
      if (isSlotTaken(e)) {
        // Spec §7: on slot_taken, refetch availability and re-prompt. The
        // cached slot list still contains the just-taken slot, so invalidate
        // before sending the user back to the Date & Time step.
        qc.invalidateQueries({ queryKey: ['availability'] });
        qc.invalidateQueries({ queryKey: ['availability-summary'] });
        wizard.handleSlotTaken();
      }
      /* other errors surface below the button */
    }
  };

  if (!wizard.service || !wizard.barber || !wizard.startAt) {
    return <p className="text-ink-muted">{t('complete_previous')}</p>;
  }

  const duplicate = isDuplicateActiveBooking(create.error);

  return (
    <section className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-2xl md:text-3xl text-ink tracking-tight">
          {t('step_confirm')}
        </h2>
        <Button
          variant="ghost"
          size="sm"
          className="rounded-pill"
          onClick={() => wizard.setStep(2)}
        >
          <ArrowLeft className="h-4 w-4" />
          {t('step_datetime')}
        </Button>
      </div>

      <div className="bg-surface border border-line rounded-2xl p-5 flex flex-col gap-4">
        <Input
          label={t('promo_code')}
          value={promoCode}
          onChange={(e) => setPromoCode(e.target.value)}
          placeholder={t('promo_placeholder')}
          className="uppercase"
        />
        <label className="flex flex-col gap-1.5">
          <span className="text-xs uppercase tracking-wider text-ink-muted">{t('notes')}</span>
          <textarea
            value={wizard.notes}
            onChange={(e) => wizard.setNotes(e.target.value)}
            rows={3}
            placeholder={t('notes_placeholder')}
            className="px-3 py-2 bg-surface border border-line rounded-md text-sm placeholder:text-ink-muted/80 focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/15 transition"
          />
        </label>
      </div>

      <Button
        onClick={onConfirm}
        loading={create.isPending}
        size="lg"
        variant="accent"
        className="self-start rounded-pill"
      >
        {t('confirm_booking')}
        <ArrowRight className="h-4 w-4" />
      </Button>
      {duplicate ? (
        <div role="alert" className="text-danger text-sm py-1">
          {tErrors('duplicate_active_booking')}{' '}
          <Link
            to="/profile"
            className="text-accent underline underline-offset-4 hover:text-ink transition"
          >
            {t('view_my_bookings')}
          </Link>
        </div>
      ) : (
        <ErrorMessage error={create.error} />
      )}
    </section>
  );
}

function Summary() {
  const { t, i18n } = useTranslation('book');
  const wizard = useBookingWizard();
  const { service, barber, startAt } = wizard;

  return (
    <aside className="lg:sticky lg:top-24 self-start">
      <div className="bg-surface border border-line rounded-2xl p-6 flex flex-col gap-4">
        <h3 className="text-xs uppercase tracking-[0.2em] text-accent">{t('summary')}</h3>

        <SummaryRow
          label={t('summary_service')}
          value={
            // Pre-v2 persisted services lack name_en — pickLocalized falls back to KA.
            service ? pickLocalized(service.name, service.name_en, i18n.language) : undefined
          }
        />
        <SummaryRow
          label={t('summary_barber')}
          value={barber ? `${barber.first_name} ${barber.last_name}` : undefined}
        />
        <SummaryRow
          label={t('summary_when')}
          value={
            startAt
              ? `${formatTbilisiDate(startAt, i18n.language)} · ${formatTbilisiTime(startAt, i18n.language)}`
              : undefined
          }
        />

        <div className="border-t border-line pt-4 flex items-baseline justify-between">
          <span className="text-xs uppercase tracking-wider text-ink-muted">
            {t('summary_price')}
          </span>
          <span className="font-display text-2xl text-ink">
            {service ? formatMoney(service.price, i18n.language) : '—'}
          </span>
        </div>

        <div className="flex gap-2">
          {wizard.step > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="rounded-pill"
              aria-label={t('summary_back')}
              onClick={() => wizard.setStep((wizard.step - 1) as 0 | 1 | 2 | 3)}
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
          )}
          {wizard.step < 3 && (
            <Button
              size="sm"
              className="flex-1 rounded-pill"
              disabled={
                (wizard.step === 0 && !service) ||
                (wizard.step === 1 && !barber) ||
                (wizard.step === 2 && !startAt)
              }
              onClick={() => wizard.setStep((wizard.step + 1) as 0 | 1 | 2 | 3)}
            >
              {wizard.step < 2 ? t('step', { n: wizard.step + 2 }) : t('step_confirm')}
              <ArrowRight className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    </aside>
  );
}

function SummaryRow({ label, value }: { label: string; value?: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs uppercase tracking-wider text-ink-muted">{label}</span>
      <span className={cn('text-sm', value ? 'text-ink' : 'text-ink-muted')}>{value || '—'}</span>
    </div>
  );
}
