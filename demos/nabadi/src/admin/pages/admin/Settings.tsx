import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Save } from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { ErrorMessage } from '@/components/ErrorMessage';
import { Input } from '@/components/Input';
import { SectionError } from '@/components/SectionError';
import {
  useAdminCreateSiteSetting,
  useAdminSiteSettings,
  useAdminUpdateSiteSetting,
  type SiteSetting,
} from '@/features/admin/cms-hooks';
import {
  useAdminCreateShopHours,
  useAdminDeleteShopHours,
  useAdminShopHours,
  useAdminUpdateShopHours,
  type AdminShopHours,
} from '@/features/admin/crud-hooks';
import { useMutationFeedback } from '@/features/admin/mutation-feedback';
import { cn } from '@/lib/cn';

/**
 * Spec §9.11 Settings: business info, shop hours, booking rules, social
 * links. Each section is its own card with its own Save — SiteSetting rows
 * for booking/business/social, /admin/shop-hours/ rows for the weekly
 * schedule.
 */

interface BookingSettingDef {
  key: string;
  defaultValue: number;
  unitKey: string;
  hintKey: string;
  min: number;
  max: number;
  step: number;
}

/**
 * Defaults mirror backend core/settings/base.py — used as placeholders + fallback
 * when no SiteSetting row exists yet.
 */
const BOOKING_FIELDS: BookingSettingDef[] = [
  {
    key: 'min_booking_lead_minutes',
    defaultValue: 30,
    unitKey: 'settings_page.unit_minutes',
    hintKey: 'settings_page.hint_min_lead',
    min: 0,
    max: 1440,
    step: 5,
  },
  {
    key: 'max_booking_advance_days',
    defaultValue: 60,
    unitKey: 'settings_page.unit_days',
    hintKey: 'settings_page.hint_max_advance',
    min: 1,
    max: 365,
    step: 1,
  },
  {
    key: 'cancellation_window_hours',
    defaultValue: 2,
    unitKey: 'settings_page.unit_hours',
    hintKey: 'settings_page.hint_cancel_window',
    min: 0,
    max: 168,
    step: 1,
  },
  {
    key: 'slot_granularity_minutes',
    defaultValue: 15,
    unitKey: 'settings_page.unit_minutes',
    hintKey: 'settings_page.hint_granularity',
    min: 5,
    max: 60,
    step: 5,
  },
];

function asNumber(v: unknown, fallback: number): number {
  if (typeof v === 'number') return v;
  if (typeof v === 'string') {
    const n = Number(v);
    return Number.isFinite(n) ? n : fallback;
  }
  return fallback;
}

function asString(v: unknown): string {
  return typeof v === 'string' ? v : '';
}

function asRecord(v: unknown): Record<string, unknown> {
  return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
}

export function AdminSettings() {
  const { t } = useTranslation('admin');
  const settings = useAdminSiteSettings();

  // Keyed lookup: settings.data is an array; index it by key for easy access.
  const byKey: Map<string, SiteSetting> = useMemo(() => {
    const m = new Map<string, SiteSetting>();
    for (const s of settings.data ?? []) m.set(s.key, s);
    return m;
  }, [settings.data]);

  const dataKey = (settings.data ?? []).map((s) => `${s.key}=${JSON.stringify(s.value)}`).join('|');
  const ready = !settings.isLoading;

  return (
    <div className="flex flex-col gap-6 max-w-3xl">
      <PageHeader
        eyebrow={t('page.settings')}
        title={t('page.settings')}
        subtitle={t('settings_page.subtitle')}
      />

      {settings.isError && (
        <SectionError error={settings.error} onRetry={() => settings.refetch()} />
      )}

      <BusinessInfoSection byKey={byKey} dataKey={dataKey} ready={ready} />
      <ShopHoursSection />
      <BookingRulesSection byKey={byKey} dataKey={dataKey} ready={ready} />
      <NotificationsSection byKey={byKey} ready={ready} />
      <SocialLinksSection byKey={byKey} dataKey={dataKey} ready={ready} />
    </div>
  );
}

interface SectionProps {
  byKey: Map<string, SiteSetting>;
  /** Serialized server values — re-derives local edits when they change. */
  dataKey: string;
  ready: boolean;
}

const inputCls =
  'h-11 px-3.5 bg-surface-2 border border-line rounded-md text-[15px] text-ink focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/15';

function SaveRow({ dirty, saving, error }: { dirty: boolean; saving: boolean; error: unknown }) {
  const { t } = useTranslation('admin');
  return (
    <>
      <ErrorMessage error={error} />
      <div className="flex items-center gap-3 pt-2 border-t border-line">
        <Button
          type="submit"
          variant="accent"
          loading={saving}
          disabled={!dirty}
          className="rounded-pill"
        >
          <Save className="h-4 w-4" />
          {t('settings_page.save_all')}
        </Button>
        {!dirty && !saving && (
          <span className="text-xs text-ink-muted">{t('settings_page.no_changes')}</span>
        )}
      </div>
    </>
  );
}

/** Upsert helper: PATCH the existing SiteSetting row or POST a new one. */
function useUpsertSetting() {
  const create = useAdminCreateSiteSetting();
  const update = useAdminUpdateSiteSetting();
  return {
    isPending: create.isPending || update.isPending,
    error: create.error ?? update.error,
    upsert: async (row: SiteSetting | undefined, key: string, value: unknown) => {
      if (row) {
        await update.mutateAsync({ id: row.id, value });
      } else {
        await create.mutateAsync({ key, value });
      }
    },
  };
}

// ---- Booking rules ---------------------------------------------------------

function BookingRulesSection({ byKey, dataKey, ready }: SectionProps) {
  const { t } = useTranslation('admin');
  const { upsert, isPending, error } = useUpsertSetting();

  // Edited values: number per field. Initialised when data loads — re-derived
  // when the underlying data changes via key change (render-time sync idiom).
  const [edits, setEdits] = useState<Map<string, number>>(new Map());
  const [trackedDataKey, setTrackedDataKey] = useState<string>('');

  if (dataKey !== trackedDataKey && ready) {
    setTrackedDataKey(dataKey);
    const next = new Map<string, number>();
    for (const f of BOOKING_FIELDS) {
      const row = byKey.get(f.key);
      next.set(f.key, asNumber(row?.value, f.defaultValue));
    }
    setEdits(next);
  }

  const dirty = useMemo(() => {
    for (const f of BOOKING_FIELDS) {
      const row = byKey.get(f.key);
      const current = asNumber(row?.value, f.defaultValue);
      const edited = edits.get(f.key) ?? f.defaultValue;
      if (current !== edited) return true;
    }
    return false;
  }, [byKey, edits]);

  const onSave = async (e: React.FormEvent) => {
    e.preventDefault();
    for (const f of BOOKING_FIELDS) {
      const row = byKey.get(f.key);
      const edited = edits.get(f.key) ?? f.defaultValue;
      const current = asNumber(row?.value, f.defaultValue);
      if (current === edited) continue;
      await upsert(row, f.key, edited);
    }
  };

  return (
    <Card>
      <h2 className="font-display text-xl tracking-tight mb-1">
        {t('settings_page.section_booking')}
      </h2>
      <p className="text-sm text-ink-muted mb-5">{t('settings_page.section_booking_hint')}</p>

      <form onSubmit={onSave} className="flex flex-col gap-5">
        {BOOKING_FIELDS.map((f) => {
          const value = edits.get(f.key) ?? f.defaultValue;
          const current = asNumber(byKey.get(f.key)?.value, f.defaultValue);
          const isEdited = current !== value;
          return (
            <div key={f.key} className="flex flex-col gap-1.5">
              <label className="flex flex-col gap-1.5">
                <span className="text-sm font-medium text-ink">
                  {t(`settings_page.label_${f.key}`)}
                </span>
                <div className="flex items-center gap-3">
                  <input
                    type="number"
                    value={value}
                    min={f.min}
                    max={f.max}
                    step={f.step}
                    onChange={(e) => {
                      const next = new Map(edits);
                      next.set(f.key, Number(e.target.value));
                      setEdits(next);
                    }}
                    className={cn(inputCls, 'w-32 tabular-nums')}
                  />
                  <span className="text-sm text-ink-muted">{t(f.unitKey)}</span>
                  {isEdited && (
                    <span className="text-[11px] uppercase tracking-[0.1em] text-accent font-medium">
                      {t('settings_page.edited')}
                    </span>
                  )}
                </div>
              </label>
              <p className="text-xs text-ink-muted ml-0.5">{t(f.hintKey)}</p>
            </div>
          );
        })}

        <SaveRow dirty={dirty} saving={isPending} error={error} />
      </form>
    </Card>
  );
}

// ---- Notifications ---------------------------------------------------------

const SMS_ENABLED_KEY = 'sms_notifications_enabled';

function asBool(v: unknown, fallback: boolean): boolean {
  return typeof v === 'boolean' ? v : fallback;
}

/**
 * Runtime on/off for booking SMS (confirmations/reminders). Backend contract:
 * SiteSetting `sms_notifications_enabled` holds a JSON boolean; an ABSENT row
 * means enabled. The toggle saves on flip — creating the row on first change.
 */
function NotificationsSection({
  byKey,
  ready,
}: {
  byKey: Map<string, SiteSetting>;
  ready: boolean;
}) {
  const { t } = useTranslation('admin');
  const { upsert, isPending, error } = useUpsertSetting();

  const row = byKey.get(SMS_ENABLED_KEY);
  const enabled = asBool(row?.value, true);

  const onToggle = async () => {
    if (isPending || !ready) return;
    await upsert(row, SMS_ENABLED_KEY, !enabled);
  };

  return (
    <Card>
      <h2 className="font-display text-xl tracking-tight mb-1">
        {t('settings_page.section_notifications')}
      </h2>
      <p className="text-sm text-ink-muted mb-5">{t('settings_page.section_notifications_hint')}</p>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-1 min-w-0">
          <span id="sms-notifications-label" className="text-sm font-medium text-ink">
            {t('settings_page.label_sms_notifications')}
          </span>
          <p className="text-xs text-ink-muted max-w-md">
            {t('settings_page.hint_sms_notifications')}
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <span className={cn('text-xs font-medium', enabled ? 'text-success' : 'text-ink-muted')}>
            {enabled ? t('settings_page.sms_on') : t('settings_page.sms_off')}
          </span>
          <button
            type="button"
            role="switch"
            aria-checked={enabled}
            aria-labelledby="sms-notifications-label"
            disabled={isPending || !ready}
            onClick={onToggle}
            className={cn(
              'relative h-6 w-11 rounded-pill border transition-colors',
              'focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/40',
              'disabled:opacity-60 disabled:cursor-not-allowed',
              enabled ? 'bg-accent border-accent' : 'bg-surface-2 border-line-strong',
            )}
          >
            <span
              aria-hidden="true"
              className={cn(
                'absolute top-1/2 -translate-y-1/2 h-4 w-4 rounded-pill transition-[left]',
                enabled ? 'left-[calc(100%-1.25rem)] bg-surface' : 'left-1 bg-line-strong',
              )}
            />
          </button>
        </div>
      </div>

      <ErrorMessage error={error} />
    </Card>
  );
}

// ---- Business info ---------------------------------------------------------

interface BusinessEdits {
  address_ka: string;
  address_en: string;
  phone: string;
  email: string;
}

function readBusiness(byKey: Map<string, SiteSetting>): BusinessEdits {
  const address = asRecord(byKey.get('business_address')?.value);
  return {
    address_ka: asString(address.ka),
    address_en: asString(address.en),
    phone: asString(byKey.get('business_phone')?.value),
    email: asString(byKey.get('business_email')?.value),
  };
}

function BusinessInfoSection({ byKey, dataKey, ready }: SectionProps) {
  const { t } = useTranslation('admin');
  const { upsert, isPending, error } = useUpsertSetting();

  const [edits, setEdits] = useState<BusinessEdits>(() => readBusiness(byKey));
  const [tracked, setTracked] = useState('');
  if (tracked !== dataKey && ready) {
    setTracked(dataKey);
    setEdits(readBusiness(byKey));
  }

  const current = readBusiness(byKey);
  const dirty =
    edits.address_ka !== current.address_ka ||
    edits.address_en !== current.address_en ||
    edits.phone !== current.phone ||
    edits.email !== current.email;

  const set = (patch: Partial<BusinessEdits>) => setEdits((prev) => ({ ...prev, ...patch }));

  const onSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (edits.address_ka !== current.address_ka || edits.address_en !== current.address_en) {
      // Preserve any extra keys another surface may have stored in the dict.
      const existing = asRecord(byKey.get('business_address')?.value);
      await upsert(byKey.get('business_address'), 'business_address', {
        ...existing,
        ka: edits.address_ka,
        en: edits.address_en,
      });
    }
    if (edits.phone !== current.phone) {
      await upsert(byKey.get('business_phone'), 'business_phone', edits.phone);
    }
    if (edits.email !== current.email) {
      await upsert(byKey.get('business_email'), 'business_email', edits.email);
    }
  };

  return (
    <Card>
      <h2 className="font-display text-xl tracking-tight mb-1">
        {t('settings_page.section_business')}
      </h2>
      <p className="text-sm text-ink-muted mb-5">{t('settings_page.section_business_hint')}</p>
      <form onSubmit={onSave} className="flex flex-col gap-4">
        <div className="grid md:grid-cols-2 gap-3">
          <Input
            label={t('settings_page.f_address_ka')}
            value={edits.address_ka}
            onChange={(e) => set({ address_ka: e.target.value })}
          />
          <Input
            label={t('settings_page.f_address_en')}
            value={edits.address_en}
            onChange={(e) => set({ address_en: e.target.value })}
          />
          <Input
            label={t('settings_page.f_phone')}
            type="tel"
            value={edits.phone}
            onChange={(e) => set({ phone: e.target.value })}
            placeholder="+995…"
          />
          <Input
            label={t('settings_page.f_email')}
            type="email"
            value={edits.email}
            onChange={(e) => set({ email: e.target.value })}
            placeholder="hello@example.ge"
          />
        </div>
        <SaveRow dirty={dirty} saving={isPending} error={error} />
      </form>
    </Card>
  );
}

// ---- Social links ----------------------------------------------------------

const SOCIAL_NETWORKS = ['facebook', 'instagram'] as const;

function readSocial(byKey: Map<string, SiteSetting>): Record<string, string> {
  const links = asRecord(byKey.get('social_links')?.value);
  return Object.fromEntries(SOCIAL_NETWORKS.map((n) => [n, asString(links[n])]));
}

function SocialLinksSection({ byKey, dataKey, ready }: SectionProps) {
  const { t } = useTranslation('admin');
  const { upsert, isPending, error } = useUpsertSetting();

  const [edits, setEdits] = useState<Record<string, string>>(() => readSocial(byKey));
  const [tracked, setTracked] = useState('');
  if (tracked !== dataKey && ready) {
    setTracked(dataKey);
    setEdits(readSocial(byKey));
  }

  const current = readSocial(byKey);
  const dirty = SOCIAL_NETWORKS.some((n) => (edits[n] ?? '') !== current[n]);

  const onSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!dirty) return;
    // Merge over the stored object so unknown networks survive the save.
    const existing = asRecord(byKey.get('social_links')?.value);
    const next: Record<string, unknown> = { ...existing };
    for (const n of SOCIAL_NETWORKS) next[n] = (edits[n] ?? '').trim();
    await upsert(byKey.get('social_links'), 'social_links', next);
  };

  return (
    <Card>
      <h2 className="font-display text-xl tracking-tight mb-1">
        {t('settings_page.section_social')}
      </h2>
      <p className="text-sm text-ink-muted mb-5">{t('settings_page.section_social_hint')}</p>
      <form onSubmit={onSave} className="flex flex-col gap-4">
        <div className="grid md:grid-cols-2 gap-3">
          {SOCIAL_NETWORKS.map((n) => (
            <Input
              key={n}
              label={t(`settings_page.f_${n}`)}
              type="url"
              value={edits[n] ?? ''}
              onChange={(e) => setEdits((prev) => ({ ...prev, [n]: e.target.value }))}
              placeholder={`https://${n}.com/…`}
              dir="ltr"
            />
          ))}
        </div>
        <SaveRow dirty={dirty} saving={isPending} error={error} />
      </form>
    </Card>
  );
}

// ---- Shop hours (admin-only) ----------------------------------------------

interface DayEdit {
  closed: boolean;
  /** 'HH:MM' for the <input type="time"> controls. */
  start: string;
  end: string;
}

const DAY_KEYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;
const DEFAULT_DAY: DayEdit = { closed: true, start: '10:00', end: '20:00' };

function hm(time: string): string {
  return time.slice(0, 5);
}

function readShopHours(rows: AdminShopHours[]): DayEdit[] {
  return DAY_KEYS.map((_, weekday) => {
    const row = rows.find((r) => r.weekday === weekday);
    return row
      ? { closed: false, start: hm(row.start_time), end: hm(row.end_time) }
      : { ...DEFAULT_DAY };
  });
}

function ShopHoursSection() {
  const { t } = useTranslation('admin');
  const hours = useAdminShopHours();
  const create = useAdminCreateShopHours();
  const update = useAdminUpdateShopHours();
  const del = useAdminDeleteShopHours();
  const feedback = useMutationFeedback();

  const rows = useMemo(() => hours.data ?? [], [hours.data]);
  const serverKey = rows.map((r) => `${r.weekday}:${r.start_time}-${r.end_time}`).join('|');

  const [edits, setEdits] = useState<DayEdit[]>(() => readShopHours(rows));
  const [tracked, setTracked] = useState('');
  if (tracked !== serverKey && !hours.isLoading && !hours.isError) {
    setTracked(serverKey);
    setEdits(readShopHours(rows));
  }

  const current = readShopHours(rows);
  const dirty = edits.some(
    (d, i) =>
      d.closed !== current[i].closed ||
      (!d.closed && (d.start !== current[i].start || d.end !== current[i].end)),
  );
  const invalid = edits.some((d) => !d.closed && d.start >= d.end);
  const saving = create.isPending || update.isPending || del.isPending;

  const setDay = (i: number, patch: Partial<DayEdit>) =>
    setEdits((prev) => prev.map((d, idx) => (idx === i ? { ...d, ...patch } : d)));

  const onSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!dirty || invalid || saving) return;
    try {
      // Diff each weekday: closed = delete the row, open = create/patch it.
      for (let weekday = 0; weekday < 7; weekday += 1) {
        const edited = edits[weekday];
        const row = rows.find((r) => r.weekday === weekday);
        if (edited.closed) {
          if (row) await del.mutateAsync(row.id);
        } else if (!row) {
          await create.mutateAsync({
            weekday,
            start_time: edited.start,
            end_time: edited.end,
          });
        } else if (hm(row.start_time) !== edited.start || hm(row.end_time) !== edited.end) {
          await update.mutateAsync({
            id: row.id,
            start_time: edited.start,
            end_time: edited.end,
          });
        }
      }
      // The row mutations stay silent — one toast for the whole diff.
      feedback.saved();
    } catch {
      /* surfaced via the mutations' error toasts */
    }
  };

  return (
    <Card>
      <h2 className="font-display text-xl tracking-tight mb-1">
        {t('settings_page.section_hours')}
      </h2>
      <p className="text-sm text-ink-muted mb-5">{t('settings_page.section_hours_hint')}</p>

      {hours.isError ? (
        <SectionError error={hours.error} onRetry={() => hours.refetch()} />
      ) : hours.isLoading ? (
        <p role="status" aria-live="polite" className="text-ink-muted text-sm">
          {t('actions.loading')}
        </p>
      ) : (
        <form onSubmit={onSave} className="flex flex-col gap-4">
          <div className="flex flex-col">
            {DAY_KEYS.map((dayKey, i) => {
              const d = edits[i];
              const rowInvalid = !d.closed && d.start >= d.end;
              return (
                <div
                  key={dayKey}
                  className="flex flex-wrap items-center gap-3 py-2.5 border-b border-line last:border-b-0"
                >
                  <span className="w-12 text-sm font-medium text-ink">
                    {t(`weekday_short.${dayKey}`)}
                  </span>
                  <label className="flex items-center gap-2 text-sm text-ink-muted">
                    <input
                      type="checkbox"
                      checked={d.closed}
                      onChange={(e) => setDay(i, { closed: e.target.checked })}
                    />
                    {t('settings_page.closed')}
                  </label>
                  {!d.closed && (
                    <span className="flex items-center gap-2 ml-auto">
                      <label className="flex items-center gap-1.5 text-xs text-ink-muted">
                        {t('settings_page.open_from')}
                        <input
                          type="time"
                          value={d.start}
                          onChange={(e) => setDay(i, { start: e.target.value })}
                          className={cn(
                            inputCls,
                            'h-9 px-2.5 tabular-nums',
                            rowInvalid && 'border-danger',
                          )}
                        />
                      </label>
                      <label className="flex items-center gap-1.5 text-xs text-ink-muted">
                        {t('settings_page.open_to')}
                        <input
                          type="time"
                          value={d.end}
                          onChange={(e) => setDay(i, { end: e.target.value })}
                          className={cn(
                            inputCls,
                            'h-9 px-2.5 tabular-nums',
                            rowInvalid && 'border-danger',
                          )}
                        />
                      </label>
                    </span>
                  )}
                </div>
              );
            })}
          </div>

          {invalid && <p className="text-sm text-danger">{t('settings_page.hours_invalid')}</p>}
          <ErrorMessage error={create.error ?? update.error ?? del.error} />

          <div className="flex items-center gap-3 pt-2 border-t border-line">
            <Button
              type="submit"
              variant="accent"
              loading={saving}
              disabled={!dirty || invalid}
              className="rounded-pill"
            >
              <Save className="h-4 w-4" />
              {t('settings_page.save_all')}
            </Button>
            {!dirty && !saving && (
              <span className="text-xs text-ink-muted">{t('settings_page.no_changes')}</span>
            )}
          </div>
        </form>
      )}
    </Card>
  );
}
