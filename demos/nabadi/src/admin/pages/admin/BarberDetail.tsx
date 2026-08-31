import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  ArrowLeft,
  BarChart3,
  CalendarOff,
  Camera,
  Clock,
  Mail,
  Phone,
  Scissors,
  Trash2,
  UserCircle2,
} from 'lucide-react';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Badge } from '@/components/Badge';
import { ErrorMessage } from '@/components/ErrorMessage';
import { Input } from '@/components/Input';
import { SectionError } from '@/components/SectionError';
import { API_BASE } from '@/lib/api';
import { ConfirmDialog } from '@/features/admin/components/ConfirmDialog';
import { PhotoUploadDialog } from '@/features/admin/components/PhotoUploadDialog';
import { BarberAnalyticsTab } from '@/features/admin/components/BarberAnalyticsTab';
import { BarberServicesTab } from '@/features/admin/components/BarberServicesTab';
import { BarberTimeOffTab } from '@/features/admin/components/BarberTimeOffTab';
import {
  useAdminBarberDetail,
  useAdminCreateWorkingHours,
  useAdminDeactivateBarber,
  useAdminDeleteBarberPhoto,
  useAdminDeleteWorkingHours,
  useAdminUpdateBarber,
  useAdminUpdateWorkingHours,
  useAdminUploadBarberPhoto,
  useAdminWorkingHours,
  type AdminBarberDetail as AdminBarberDetailType,
} from '@/features/admin/crud-hooks';
import { cn } from '@/lib/cn';

function resolvePhotoUrl(photo: string | null): string | null {
  if (!photo) return null;
  // blob:/data: too — an upload in the demo is served straight from memory
  // (serialize.mediaUrl passes these through by the same rule).
  if (/^(https?:|blob:|data:)/.test(photo)) return photo;
  // Backend returns "/media/barbers/foo.jpg" — prefix with the API host.
  const host = API_BASE.replace(/\/api\/?$/, '');
  return `${host}${photo.startsWith('/') ? '' : '/'}${photo}`;
}

const WEEKDAY_KEYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;

// Spec §9.4 tab order: Profile, Services & pricing, Working hours, Time off, Analytics.
type Tab = 'profile' | 'services' | 'hours' | 'time_off' | 'analytics';
const TABS: { key: Tab; icon: typeof UserCircle2; labelKey: string }[] = [
  { key: 'profile', icon: UserCircle2, labelKey: 'barbers_page.tab_profile' },
  { key: 'services', icon: Scissors, labelKey: 'barbers_page.tab_services' },
  { key: 'hours', icon: Clock, labelKey: 'barbers_page.tab_hours' },
  { key: 'time_off', icon: CalendarOff, labelKey: 'barbers_page.tab_time_off_short' },
  { key: 'analytics', icon: BarChart3, labelKey: 'barbers_page.tab_analytics' },
];

export function BarberDetail() {
  const { t } = useTranslation('admin');
  const { id } = useParams<{ id: string }>();
  const barberId = id ? Number(id) : null;
  const { data: barber, isLoading } = useAdminBarberDetail(barberId);
  const [tab, setTab] = useState<Tab>('profile');

  if (isLoading)
    return (
      <p role="status" aria-live="polite" className="text-ink-muted">
        {t('actions.loading')}
      </p>
    );
  if (!barber || !barberId)
    return (
      <div>
        <Link to="/barbers" className="text-accent hover:underline text-sm">
          ← {t('page.barbers')}
        </Link>
        <p className="text-ink-muted mt-4">{t('not_found')}</p>
      </div>
    );

  const photoUrl = resolvePhotoUrl(barber.photo);
  const fullName = `${barber.user_first_name} ${barber.user_last_name}`.trim();

  return (
    <div className="flex flex-col gap-6 max-w-4xl">
      <Link
        to="/barbers"
        className="inline-flex items-center gap-1.5 text-ink-muted hover:text-ink text-sm self-start transition"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        {t('page.barbers')}
      </Link>

      {/* Hero header */}
      <Card>
        <div className="flex flex-col sm:flex-row gap-5 items-start">
          <div className="w-28 sm:w-32 aspect-[4/5] bg-bg border border-line rounded-2xl overflow-hidden shrink-0">
            {photoUrl ? (
              <img src={photoUrl} alt={fullName} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-ink-muted/30 font-display text-5xl">
                {(barber.user_first_name?.[0] ?? '?').toUpperCase()}
              </div>
            )}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-3 mb-2">
              <h1 className="font-display text-3xl md:text-4xl text-ink tracking-tight leading-tight">
                {fullName}
              </h1>
              <Badge variant={barber.is_active ? 'success' : 'danger'}>
                {barber.is_active ? t('customers.active') : t('customers.inactive')}
              </Badge>
            </div>

            <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-ink-muted">
              <a
                href={`tel:${barber.user_phone}`}
                className="inline-flex items-center gap-1.5 hover:text-ink transition tabular-nums"
              >
                <Phone className="h-3.5 w-3.5" />
                {barber.user_phone}
              </a>
              {barber.user_email && (
                <a
                  href={`mailto:${barber.user_email}`}
                  className="inline-flex items-center gap-1.5 hover:text-ink transition truncate"
                >
                  <Mail className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">{barber.user_email}</span>
                </a>
              )}
            </div>

            {barber.specialties.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-3">
                {barber.specialties.map((s) => (
                  <Badge key={s.id} variant="default">
                    {s.name}
                  </Badge>
                ))}
              </div>
            )}

            {barber.bio && <p className="text-sm text-ink-muted mt-3 max-w-2xl">{barber.bio}</p>}
          </div>
        </div>
      </Card>

      <nav className="flex gap-1 border-b border-line overflow-x-auto">
        {TABS.map(({ key, icon: Icon, labelKey }) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={cn(
              'inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition border-b-2 -mb-px whitespace-nowrap',
              tab === key
                ? 'text-ink border-accent'
                : 'text-ink-muted border-transparent hover:text-ink',
            )}
          >
            <Icon className="h-3.5 w-3.5" />
            {t(labelKey)}
          </button>
        ))}
      </nav>

      {tab === 'profile' && <ProfileTab barberId={barberId} barber={barber} />}
      {tab === 'services' && <BarberServicesTab barberId={barberId} />}
      {tab === 'hours' && <HoursTab barberId={barberId} />}
      {tab === 'time_off' && <BarberTimeOffTab barberId={barberId} barberName={fullName} />}
      {tab === 'analytics' && <BarberAnalyticsTab barberId={barberId} />}
    </div>
  );
}

function ProfileTab({ barberId, barber }: { barberId: number; barber: AdminBarberDetailType }) {
  const { t } = useTranslation('admin');
  const update = useAdminUpdateBarber();
  const deactivate = useAdminDeactivateBarber();
  const uploadPhoto = useAdminUploadBarberPhoto();
  const deletePhoto = useAdminDeleteBarberPhoto();
  const [bio, setBio] = useState(barber.bio);
  const [displayOrder, setDisplayOrder] = useState(barber.display_order);
  const [isActive, setIsActive] = useState(barber.is_active);
  const [photoOpen, setPhotoOpen] = useState(false);
  const [confirming, setConfirming] = useState<'photo' | 'deactivate' | null>(null);

  const photoUrl = resolvePhotoUrl(barber.photo);
  const confirmPending = deletePhoto.isPending || deactivate.isPending;

  const runConfirmed = async () => {
    if (!confirming || confirmPending) return;
    try {
      if (confirming === 'photo') {
        await deletePhoto.mutateAsync(barberId);
      } else {
        await deactivate.mutateAsync(barberId);
      }
      setConfirming(null);
    } catch {
      /* surfaced via toast + inline error */
    }
  };

  const onSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await update.mutateAsync({
        id: barberId,
        bio,
        display_order: displayOrder,
        is_active: isActive,
      });
    } catch {
      /* surfaced */
    }
  };

  const onUpload = async (blob: Blob) => {
    await uploadPhoto.mutateAsync({ id: barberId, blob, filename: `barber-${barberId}.jpg` });
    setPhotoOpen(false);
  };

  const onRemovePhoto = () => {
    if (!barber.photo) return;
    setConfirming('photo');
  };

  return (
    <Card>
      <div className="flex flex-col sm:flex-row gap-6">
        {/* Photo column */}
        <div className="flex flex-col items-start gap-3 sm:w-48 shrink-0">
          <div className="relative w-40 aspect-[4/5] bg-bg border border-line rounded-2xl overflow-hidden">
            {photoUrl ? (
              <img
                src={photoUrl}
                alt={`${barber.user_first_name} ${barber.user_last_name}`}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-ink-muted/40 font-display text-5xl">
                {(barber.user_first_name?.[0] ?? '?').toUpperCase()}
              </div>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="primary"
              size="sm"
              onClick={() => setPhotoOpen(true)}
              className="rounded-pill"
            >
              <Camera className="h-3.5 w-3.5" />
              {photoUrl ? t('barbers_page.photo_change') : t('barbers_page.photo_upload')}
            </Button>
            {photoUrl && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={onRemovePhoto}
                loading={deletePhoto.isPending}
                className="rounded-pill text-ink-muted hover:text-danger"
              >
                <Trash2 className="h-3.5 w-3.5" />
                {t('barbers_page.photo_remove')}
              </Button>
            )}
          </div>
          <p className="text-xs text-ink-muted">{t('barbers_page.photo_hint')}</p>
        </div>

        {/* Profile fields */}
        <form onSubmit={onSave} className="flex flex-col gap-3 flex-1">
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-ink">{t('barbers_page.f_bio')}</span>
            <textarea
              rows={4}
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              className="px-3.5 py-2.5 bg-surface-2 border border-line rounded-md text-[15px] text-ink focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/15"
            />
          </label>
          <Input
            label={t('barbers_page.f_display_order')}
            type="number"
            value={displayOrder}
            onChange={(e) => setDisplayOrder(Number(e.target.value))}
          />
          <label className="flex items-center gap-2 text-sm mt-1">
            <input
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
            />
            {t('customers.active')}
          </label>
          <ErrorMessage error={update.error ?? deactivate.error ?? deletePhoto.error} />
          <div className="flex flex-wrap gap-2 justify-end mt-2">
            <Button
              type="button"
              variant="danger"
              onClick={() => setConfirming('deactivate')}
              loading={deactivate.isPending}
              className="rounded-pill"
            >
              {t('barbers_page.deactivate')}
            </Button>
            <Button
              type="submit"
              variant="accent"
              loading={update.isPending}
              className="rounded-pill"
            >
              {t('actions.save')}
            </Button>
          </div>
        </form>
      </div>

      <PhotoUploadDialog
        open={photoOpen}
        onClose={() => setPhotoOpen(false)}
        onConfirm={onUpload}
        uploading={uploadPhoto.isPending}
        error={uploadPhoto.error}
      />

      <ConfirmDialog
        open={confirming !== null}
        onOpenChange={(o) => !o && !confirmPending && setConfirming(null)}
        title={
          confirming === 'photo'
            ? t('barbers_page.photo_remove_confirm')
            : t('barbers_page.deactivate_confirm')
        }
        body={
          confirming === 'photo'
            ? t('barbers_page.photo_remove_body')
            : t('barbers_page.deactivate_body')
        }
        confirmLabel={
          confirming === 'photo' ? t('actions.confirm_remove') : t('barbers_page.deactivate')
        }
        cancelLabel={t('actions.cancel')}
        destructive
        loading={confirmPending}
        onConfirm={runConfirmed}
      />
    </Card>
  );
}

function HoursTab({ barberId }: { barberId: number }) {
  const { t } = useTranslation('admin');
  const hoursQuery = useAdminWorkingHours(barberId);
  const { isLoading } = hoursQuery;
  const hours = hoursQuery.data ?? [];
  const create = useAdminCreateWorkingHours();
  const update = useAdminUpdateWorkingHours();
  const del = useAdminDeleteWorkingHours();

  const byWeekday = new Map<number, (typeof hours)[number]>();
  for (const h of hours) byWeekday.set(h.weekday, h);

  const [adding, setAdding] = useState<number | null>(null);
  const [start, setStart] = useState('10:00');
  const [end, setEnd] = useState('20:00');
  // Inline edit of an existing row — no more delete + re-add (which briefly
  // made the day look closed and produced two audit events).
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editStart, setEditStart] = useState('10:00');
  const [editEnd, setEditEnd] = useState('20:00');
  const [deleting, setDeleting] = useState<{ id: number; dayKey: string } | null>(null);

  const onAdd = async (weekday: number) => {
    try {
      await create.mutateAsync({
        barber: barberId,
        weekday,
        start_time: `${start}:00`,
        end_time: `${end}:00`,
      });
      setAdding(null);
    } catch {
      /* surfaced */
    }
  };

  const beginEdit = (wh: { id: number; start_time: string; end_time: string }) => {
    setAdding(null);
    setEditingId(wh.id);
    setEditStart(wh.start_time.slice(0, 5));
    setEditEnd(wh.end_time.slice(0, 5));
  };

  const onSaveEdit = async () => {
    if (editingId === null) return;
    try {
      await update.mutateAsync({
        id: editingId,
        start_time: `${editStart}:00`,
        end_time: `${editEnd}:00`,
      });
      setEditingId(null);
    } catch {
      /* surfaced */
    }
  };

  const onConfirmDelete = async () => {
    if (!deleting || del.isPending) return;
    try {
      await del.mutateAsync(deleting.id);
      setDeleting(null);
    } catch {
      /* surfaced */
    }
  };

  if (hoursQuery.isError) {
    return <SectionError error={hoursQuery.error} onRetry={() => hoursQuery.refetch()} />;
  }

  return (
    <Card>
      {isLoading && (
        <p role="status" aria-live="polite" className="text-ink-muted text-sm">
          {t('actions.loading')}
        </p>
      )}
      <ErrorMessage error={create.error ?? update.error ?? del.error} />
      <div className="flex flex-col gap-2">
        {WEEKDAY_KEYS.map((dayKey, weekday) => {
          const wh = byWeekday.get(weekday);
          const isEditing = wh !== undefined && editingId === wh.id;
          return (
            <div
              key={weekday}
              className="flex items-center justify-between gap-3 border-b border-line pb-2 last:border-b-0"
            >
              <div className="w-16 text-ink">{t(`weekday_short.${dayKey}`)}</div>
              {wh ? (
                isEditing ? (
                  <div className="flex-1 flex gap-2">
                    <Input
                      label={t('barbers_page.from')}
                      type="time"
                      value={editStart}
                      onChange={(e) => setEditStart(e.target.value)}
                    />
                    <Input
                      label={t('barbers_page.to')}
                      type="time"
                      value={editEnd}
                      onChange={(e) => setEditEnd(e.target.value)}
                    />
                  </div>
                ) : (
                  <div className="flex-1 text-ink-muted tabular-nums">
                    {wh.start_time.slice(0, 5)} – {wh.end_time.slice(0, 5)}
                  </div>
                )
              ) : adding === weekday ? (
                <div className="flex-1 flex gap-2">
                  <Input
                    label={t('barbers_page.from')}
                    type="time"
                    value={start}
                    onChange={(e) => setStart(e.target.value)}
                  />
                  <Input
                    label={t('barbers_page.to')}
                    type="time"
                    value={end}
                    onChange={(e) => setEnd(e.target.value)}
                  />
                </div>
              ) : (
                <div className="flex-1 text-ink-muted text-sm">—</div>
              )}
              <div>
                {wh ? (
                  isEditing ? (
                    <div className="flex gap-2">
                      <Button
                        variant="ghost"
                        className="rounded-pill"
                        onClick={() => setEditingId(null)}
                      >
                        {t('actions.cancel')}
                      </Button>
                      <Button
                        className="rounded-pill"
                        onClick={onSaveEdit}
                        loading={update.isPending}
                      >
                        {t('actions.save')}
                      </Button>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <Button
                        variant="ghost"
                        className="rounded-pill"
                        onClick={() => beginEdit(wh)}
                      >
                        {t('actions.edit')}
                      </Button>
                      <Button
                        variant="ghost"
                        className="rounded-pill text-ink-muted hover:text-danger"
                        onClick={() => setDeleting({ id: wh.id, dayKey })}
                        loading={del.isPending && del.variables === wh.id}
                      >
                        {t('actions.remove')}
                      </Button>
                    </div>
                  )
                ) : adding === weekday ? (
                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      className="rounded-pill"
                      onClick={() => setAdding(null)}
                    >
                      {t('actions.cancel')}
                    </Button>
                    <Button
                      className="rounded-pill"
                      onClick={() => onAdd(weekday)}
                      loading={create.isPending}
                    >
                      {t('actions.save')}
                    </Button>
                  </div>
                ) : (
                  <Button
                    variant="ghost"
                    className="rounded-pill"
                    onClick={() => {
                      setEditingId(null);
                      setAdding(weekday);
                    }}
                  >
                    {t('barbers_page.add')}
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(o) => !o && !del.isPending && setDeleting(null)}
        title={t('barbers_page.hours_delete_title')}
        body={t('barbers_page.hours_delete_body', {
          day: deleting ? t(`weekday_short.${deleting.dayKey}`) : '',
        })}
        confirmLabel={t('actions.confirm_remove')}
        cancelLabel={t('actions.cancel')}
        destructive
        loading={del.isPending}
        onConfirm={onConfirmDelete}
      />
    </Card>
  );
}
