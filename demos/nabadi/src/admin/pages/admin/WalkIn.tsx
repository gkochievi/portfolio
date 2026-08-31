import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { CalendarPlus, Clock, Zap } from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { ErrorMessage } from '@/components/ErrorMessage';
import { Input } from '@/components/Input';
import {
  useAdminAvailability,
  useAdminBarbers,
  useAdminCreateBooking,
  useAdminServices,
} from '@/features/admin/hooks';
import { AvailabilityCalendar } from '@/features/admin/components/AvailabilityCalendar';
import { cn } from '@/lib/cn';
import { formatTbilisiTime, todayTbilisiYmd } from '@/lib/datetime';
import { pickLocalized } from '@/lib/localized';
import { normalizePhoneE164 } from '@/lib/phone';

function ymd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

type Mode = 'schedule' | 'walkin';

/** Round a Date up to the next 5-minute boundary, return ISO with seconds=0. */
function roundedNowIso(): string {
  const d = new Date();
  d.setSeconds(0, 0);
  const min = d.getMinutes();
  const remainder = min % 5;
  if (remainder !== 0) {
    d.setMinutes(min + (5 - remainder));
  }
  return d.toISOString();
}

export function WalkIn() {
  const { t, i18n } = useTranslation('admin');
  const navigate = useNavigate();
  // The bookings calendar links here with ?barber_id=&date= so an empty lane
  // slot is one click away from a prefilled form.
  const [searchParams] = useSearchParams();
  const { data: barbers } = useAdminBarbers();
  const { data: services } = useAdminServices();
  const create = useAdminCreateBooking();

  const [mode, setMode] = useState<Mode>('schedule');
  const [walkInName, setWalkInName] = useState('');
  const [walkInEmail, setWalkInEmail] = useState('');
  const [walkInPhone, setWalkInPhone] = useState('');
  const [barberId, setBarberId] = useState<number | ''>(() => {
    const raw = Number(searchParams.get('barber_id'));
    return Number.isInteger(raw) && raw > 0 ? raw : '';
  });
  const [serviceId, setServiceId] = useState<number | ''>('');
  const [date, setDate] = useState<string>(() => {
    const raw = searchParams.get('date');
    return raw && /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : todayTbilisiYmd();
  });
  const [pickedSlot, setPickedSlot] = useState<string | null>(null);
  const [notes, setNotes] = useState('');

  // Reminders go over SMS — the number must be a reachable E.164 phone
  // (project standard: default region GE / +995). Normalized before submit.
  const normalizedPhone = normalizePhoneE164(walkInPhone);
  const phoneError = walkInPhone.trim() !== '' && !normalizedPhone ? 'phone_invalid' : undefined;

  const availability = useAdminAvailability(
    mode === 'schedule' && barberId ? Number(barberId) : null,
    mode === 'schedule' && serviceId ? Number(serviceId) : null,
    mode === 'schedule' ? date : null,
  );

  const startAt: string | null = useMemo(() => {
    if (mode === 'walkin') return roundedNowIso();
    return pickedSlot;
  }, [mode, pickedSlot]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!barberId || !serviceId || !startAt || !walkInName || !normalizedPhone) return;
    try {
      await create.mutateAsync({
        walk_in_name: walkInName,
        walk_in_phone: normalizedPhone,
        walk_in_email: walkInEmail || undefined,
        barber_id: Number(barberId),
        service_id: Number(serviceId),
        start_at: startAt,
        notes: notes || undefined,
      });
      navigate('/bookings');
    } catch {
      /* surfaced */
    }
  };

  const canSubmit = Boolean(barberId && serviceId && walkInName && startAt && normalizedPhone);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow={t('page.walk_in')}
        title={t('page.walk_in')}
        subtitle={t('walk_in_page.subtitle')}
      />

      <p className="text-sm text-ink-muted max-w-3xl">{t('walk_in_page.intro')}</p>

      {/* Mode picker */}
      <div className="grid sm:grid-cols-2 gap-3 max-w-3xl">
        <ModeCard
          active={mode === 'schedule'}
          icon={<Clock className="h-5 w-5" />}
          title={t('walk_in_page.mode_schedule')}
          hint={t('walk_in_page.mode_schedule_hint')}
          onClick={() => {
            setMode('schedule');
            // An inactive barber picked for an immediate walk-in has no
            // public availability — drop the selection rather than 404.
            if (barberId && !barbers?.find((b) => b.id === Number(barberId))?.is_active) {
              setBarberId('');
            }
          }}
        />
        <ModeCard
          active={mode === 'walkin'}
          icon={<Zap className="h-5 w-5" />}
          title={t('walk_in_page.mode_walkin')}
          hint={t('walk_in_page.mode_walkin_hint')}
          onClick={() => setMode('walkin')}
        />
      </div>

      <form onSubmit={onSubmit} className="flex flex-col gap-6">
        {/* TOP — 5 fields horizontally: Name · Email · Phone · Service · Barber */}
        <Card>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <Input
              label={t('walk_in_page.f_name')}
              value={walkInName}
              onChange={(e) => setWalkInName(e.target.value)}
              required
            />
            <Input
              label={t('walk_in_page.f_email')}
              type="email"
              value={walkInEmail}
              onChange={(e) => setWalkInEmail(e.target.value)}
              placeholder="name@example.com"
            />
            <Input
              label={t('walk_in_page.f_phone')}
              type="tel"
              value={walkInPhone}
              onChange={(e) => setWalkInPhone(e.target.value)}
              placeholder="+995..."
              error={phoneError}
              required
            />
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-ink">{t('walk_in_page.f_service')}</span>
              <select
                value={serviceId}
                onChange={(e) => setServiceId(e.target.value ? Number(e.target.value) : '')}
                required
                className="h-11 px-3.5 bg-surface-2 border border-line rounded-md text-[15px] focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/15"
              >
                <option value="">{t('walk_in_page.select')}</option>
                {services?.map((s) => (
                  <option key={s.id} value={s.id}>
                    {pickLocalized(s.name, s.name_en, i18n.language)} —{' '}
                    {t('walk_in_page.duration_label', {
                      minutes: s.duration_minutes,
                      price: s.price,
                    })}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-ink">{t('walk_in_page.f_barber')}</span>
              <select
                value={barberId}
                onChange={(e) => setBarberId(e.target.value ? Number(e.target.value) : '')}
                required
                className="h-11 px-3.5 bg-surface-2 border border-line rounded-md text-[15px] focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/15"
              >
                <option value="">{t('walk_in_page.select')}</option>
                {/* Scheduling asks the public availability endpoint, which
                    404s for an inactive barber — only offer them for an
                    immediate walk-in, where no slot lookup happens. */}
                {(mode === 'schedule' ? (barbers ?? []).filter((b) => b.is_active) : (barbers ?? [])).map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.user_first_name} {b.user_last_name}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </Card>

        {/* MIDDLE — date + time picker (schedule mode) */}
        {mode === 'schedule' && (
          <div className="grid gap-6 md:grid-cols-[auto_minmax(0,1fr)]">
            <Card className="md:w-[340px]">
              <div className="flex flex-col gap-1.5">
                <span className="text-sm font-medium text-ink">{t('walk_in_page.f_date')}</span>
                <AvailabilityCalendar
                  barberId={barberId ? Number(barberId) : null}
                  serviceId={serviceId ? Number(serviceId) : null}
                  selected={date ? new Date(date + 'T12:00:00') : undefined}
                  onSelect={(d) => {
                    setDate(d ? ymd(d) : '');
                    setPickedSlot(null);
                  }}
                />
              </div>
            </Card>
            <Card>
              <SlotPicker
                loading={availability.isLoading}
                error={availability.isError ? availability.error : null}
                slots={availability.data?.slots ?? []}
                noSlotsLabel={t('walk_in_page.no_slots')}
                hintLabel={t('walk_in_page.select_first')}
                serviceSelected={!!serviceId && !!barberId}
                value={pickedSlot}
                onChange={setPickedSlot}
                label={t('walk_in_page.f_time')}
              />
            </Card>
          </div>
        )}

        {/* MIDDLE — auto-picked start time (walk-in mode) */}
        {mode === 'walkin' && (
          <Card>
            <div className="inline-flex items-center gap-2 px-3 py-2 rounded-pill bg-accent-soft text-ink text-sm font-medium">
              <Zap className="h-3.5 w-3.5" />
              {t('walk_in_page.starts_in', {
                time: startAt
                  ? formatTbilisiTime(startAt)
                  : '—',
              })}
            </div>
          </Card>
        )}

        {/* BOTTOM — notes + submit */}
        <Card>
          <div className="flex flex-col gap-4">
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-ink">{t('walk_in_page.f_notes')}</span>
              <textarea
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="px-3.5 py-2.5 bg-surface-2 border border-line rounded-md text-[15px] focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/15"
              />
            </label>

            <ErrorMessage error={create.error} />

            <Button
              type="submit"
              loading={create.isPending}
              disabled={!canSubmit}
              variant="accent"
              size="lg"
              className="self-start rounded-pill"
            >
              <CalendarPlus className="h-4 w-4" />
              {t('walk_in_page.submit')}
            </Button>
          </div>
        </Card>
      </form>
    </div>
  );
}

function ModeCard({
  active,
  icon,
  title,
  hint,
  onClick,
}: {
  active: boolean;
  icon: React.ReactNode;
  title: string;
  hint: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex items-start gap-3 text-left p-5 rounded-2xl border transition',
        active
          ? 'border-ink bg-ink text-bg shadow-[var(--shadow-soft)]'
          : 'border-line bg-surface text-ink hover:border-line-strong',
      )}
    >
      <span
        className={cn(
          'inline-flex items-center justify-center w-10 h-10 rounded-pill shrink-0',
          active ? 'bg-accent text-bg' : 'bg-line/60 text-ink-muted',
        )}
      >
        {icon}
      </span>
      <div className="flex-1 min-w-0">
        <div className="font-display text-lg tracking-tight">{title}</div>
        <p className={cn('text-sm mt-0.5', active ? 'text-bg/70' : 'text-ink-muted')}>{hint}</p>
      </div>
    </button>
  );
}

function SlotPicker({
  loading,
  error,
  slots,
  value,
  onChange,
  label,
  noSlotsLabel,
  hintLabel,
  serviceSelected,
}: {
  loading: boolean;
  error?: unknown;
  slots: { start_at: string; end_at: string }[];
  value: string | null;
  onChange: (v: string) => void;
  label: string;
  noSlotsLabel: string;
  hintLabel: string;
  serviceSelected: boolean;
}) {
  const { t } = useTranslation('admin');
  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm font-medium text-ink">{label}</span>
      {!serviceSelected ? (
        <p className="text-sm text-ink-muted">{hintLabel}</p>
      ) : error ? (
        <ErrorMessage error={error} />
      ) : loading ? (
        <p role="status" aria-live="polite" className="text-sm text-ink-muted">
          {t('actions.loading')}
        </p>
      ) : slots.length === 0 ? (
        <p className="text-sm text-ink-muted">{noSlotsLabel}</p>
      ) : (
        <div className="grid gap-2 grid-cols-[repeat(auto-fill,minmax(72px,1fr))]">
          {slots.map((s) => {
            const time = formatTbilisiTime(s.start_at);
            const selected = value === s.start_at;
            return (
              <button
                key={s.start_at}
                type="button"
                onClick={() => onChange(s.start_at)}
                className={cn(
                  'px-3 py-2 rounded-md border text-sm font-medium tabular-nums transition',
                  selected
                    ? 'bg-ink text-bg border-ink'
                    : 'bg-surface text-ink border-line hover:border-line-strong',
                )}
              >
                {time}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
