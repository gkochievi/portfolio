import { useMemo, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Mail, Phone, Plus, Search, Settings2, Users } from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Badge } from '@/components/Badge';
import { ErrorMessage } from '@/components/ErrorMessage';
import { Input } from '@/components/Input';
import { EmptyState } from '@/components/EmptyState';
import { SectionError } from '@/components/SectionError';
import { Dialog, DialogContent, DialogFooter, DialogTitle } from '@/components/Dialog';
import { useAdminBarbers, type AdminBarberSummary } from '@/features/admin/hooks';
import { API_BASE } from '@/lib/api';
import { useAdminCreateBarber, useAdminToggleBarberActive } from '@/features/admin/crud-hooks';
import { cn } from '@/lib/cn';

type ScopeKey = 'active' | 'all' | 'inactive';

function resolvePhotoUrl(photo: string | null): string | null {
  if (!photo) return null;
  // blob:/data: too — an upload in the demo is served straight from memory
  // (serialize.mediaUrl passes these through by the same rule).
  if (/^(https?:|blob:|data:)/.test(photo)) return photo;
  const host = API_BASE.replace(/\/api\/?$/, '');
  return `${host}${photo.startsWith('/') ? '' : '/'}${photo}`;
}

export function AdminBarbers() {
  const { t } = useTranslation('admin');
  const barbers = useAdminBarbers();
  const [creating, setCreating] = useState(false);
  const [search, setSearch] = useState('');
  const [scope, setScope] = useState<ScopeKey>('active');

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (barbers.data ?? []).filter((b) => {
      if (scope === 'active' && !b.is_active) return false;
      if (scope === 'inactive' && b.is_active) return false;
      if (!q) return true;
      const blob = [
        b.user_first_name,
        b.user_last_name,
        b.user_phone ?? '',
        b.user_email ?? '',
        ...b.specialties.map((s) => s.name),
      ]
        .join(' ')
        .toLowerCase();
      return blob.includes(q);
    });
  }, [barbers.data, search, scope]);

  const stats = useMemo(() => {
    const all = barbers.data ?? [];
    return {
      total: all.length,
      active: all.filter((b) => b.is_active).length,
      with_photo: all.filter((b) => !!b.photo).length,
    };
  }, [barbers.data]);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow={t('page.barbers')}
        title={t('page.barbers')}
        subtitle={t('barbers_page.subtitle')}
        actions={
          <Button onClick={() => setCreating(true)} variant="accent" className="rounded-pill">
            <Plus className="h-4 w-4" />
            {t('barbers_page.new')}
          </Button>
        }
      />

      <div className="grid grid-cols-3 gap-3">
        <StatBlock label={t('barbers_page.stat_total')} value={stats.total} />
        <StatBlock label={t('barbers_page.stat_active')} value={stats.active} accent />
        <StatBlock label={t('barbers_page.stat_with_photo')} value={stats.with_photo} />
      </div>

      <Card>
        <div className="flex flex-wrap gap-3 items-center">
          <div className="flex flex-wrap gap-2">
            {(['active', 'all', 'inactive'] as ScopeKey[]).map((s) => (
              <Chip key={s} active={scope === s} onClick={() => setScope(s)}>
                {t(`barbers_page.scope_${s}`)}
              </Chip>
            ))}
          </div>
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-ink-muted pointer-events-none" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('barbers_page.search_placeholder')}
              className="h-11 pl-10 pr-3.5 w-full bg-surface-2 border border-line rounded-md text-[15px] text-ink placeholder:text-ink-muted/60 focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/15 transition"
            />
          </div>
        </div>
      </Card>

      {barbers.isError ? (
        <SectionError error={barbers.error} onRetry={() => barbers.refetch()} />
      ) : barbers.isLoading ? (
        <Card>
          <p role="status" aria-live="polite" className="text-ink-muted text-sm">
            {t('actions.loading')}
          </p>
        </Card>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<Users className="h-5 w-5" />}
          title={t('barbers_page.no_barbers')}
          hint={search ? t('barbers_page.empty_hint_search') : undefined}
        />
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((b) => (
            <BarberCard key={b.id} barber={b} />
          ))}
        </div>
      )}

      <CreateBarberModal open={creating} onClose={() => setCreating(false)} />
    </div>
  );
}

function BarberCard({ barber }: { barber: AdminBarberSummary }) {
  const { t } = useTranslation('admin');
  const toggle = useAdminToggleBarberActive();
  const photoUrl = resolvePhotoUrl(barber.photo);
  const fullName = `${barber.user_first_name} ${barber.user_last_name}`.trim();

  return (
    <Link
      to={`/barbers/${barber.id}`}
      className={cn(
        'group bg-surface border border-line rounded-2xl overflow-hidden flex flex-col transition',
        'hover:border-line-strong hover:shadow-[var(--shadow-soft)]',
        !barber.is_active && 'opacity-70',
      )}
    >
      {/* Photo / initials */}
      <div className="aspect-[4/5] bg-bg overflow-hidden relative">
        {photoUrl ? (
          <img
            src={photoUrl}
            alt={fullName}
            className="w-full h-full object-cover group-hover:scale-[1.03] transition duration-500"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-ink-muted/30 font-display text-7xl">
            {(barber.user_first_name?.[0] ?? '?').toUpperCase()}
          </div>
        )}
        {/* Inline active toggle, overlay on photo */}
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            toggle.mutate({ id: barber.id, is_active: !barber.is_active });
          }}
          disabled={toggle.isPending}
          aria-label={barber.is_active ? t('services.deactivate') : t('services.activate')}
          className={cn(
            'absolute top-3 right-3 inline-flex items-center gap-1.5 px-3 py-1 rounded-pill text-[11px] uppercase tracking-[0.1em] font-medium border transition',
            barber.is_active
              ? 'bg-success text-bg border-success'
              : 'bg-danger text-bg border-danger',
          )}
        >
          {barber.is_active ? t('customers.active') : t('customers.inactive')}
        </button>
      </div>

      {/* Info */}
      <div className="p-5 flex flex-col gap-3 flex-1">
        <div>
          <h3 className="font-display text-xl text-ink tracking-tight">{fullName}</h3>
          <div className="flex flex-col gap-0.5 mt-1.5">
            <span className="inline-flex items-center gap-1.5 text-xs text-ink-muted tabular-nums">
              <Phone className="h-3 w-3" />
              {barber.user_phone}
            </span>
            {barber.user_email && (
              <span className="inline-flex items-center gap-1.5 text-xs text-ink-muted truncate">
                <Mail className="h-3 w-3 shrink-0" />
                <span className="truncate">{barber.user_email}</span>
              </span>
            )}
          </div>
        </div>

        {barber.specialties.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {barber.specialties.slice(0, 4).map((s) => (
              <Badge key={s.id} variant="default">
                {s.name}
              </Badge>
            ))}
            {barber.specialties.length > 4 && (
              <Badge variant="default">+{barber.specialties.length - 4}</Badge>
            )}
          </div>
        )}

        {barber.bio && <p className="text-sm text-ink-muted line-clamp-2 flex-1">{barber.bio}</p>}

        <div className="flex items-center justify-between pt-3 border-t border-line">
          <span className="text-xs text-ink-muted tabular-nums">
            {t('barbers_page.offers_n_services', { count: barber.service_count })}
          </span>
          <span className="inline-flex items-center gap-1 text-xs font-medium text-ink group-hover:text-accent transition">
            <Settings2 className="h-3.5 w-3.5" />
            {t('barbers_page.manage')}
          </span>
        </div>
      </div>
    </Link>
  );
}

function Chip({
  children,
  active,
  onClick,
}: {
  children: ReactNode;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'px-4 py-1.5 rounded-pill border text-sm font-medium transition',
        active
          ? 'bg-ink text-bg border-ink'
          : 'bg-surface text-ink-muted border-line hover:border-line-strong hover:text-ink',
      )}
    >
      {children}
    </button>
  );
}

function StatBlock({ label, value, accent }: { label: string; value: number; accent?: boolean }) {
  return (
    <div
      className={cn(
        'rounded-xl border px-3 py-2.5 flex flex-col gap-0.5',
        accent ? 'bg-success/10 border-success/20 text-success' : 'bg-surface border-line text-ink',
      )}
    >
      <span
        className={cn(
          'text-[10px] uppercase tracking-[0.12em] font-medium',
          /* Dimming the success-tinted label lands ~2.7:1 — below AA. */
          !accent && 'opacity-70',
        )}
      >
        {label}
      </span>
      <span className="font-display text-xl font-semibold tabular-nums leading-none">{value}</span>
    </div>
  );
}

function CreateBarberModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useTranslation('admin');
  const create = useAdminCreateBarber();
  const [phone, setPhone] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [bio, setBio] = useState('');

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phone || !firstName || !lastName || !password) return;
    try {
      await create.mutateAsync({
        phone,
        first_name: firstName,
        last_name: lastName,
        email: email || undefined,
        password,
        bio,
      });
      setPhone('');
      setFirstName('');
      setLastName('');
      setEmail('');
      setPassword('');
      setBio('');
      onClose();
    } catch {
      /* surfaced */
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogTitle>{t('barbers_page.modal_new_title')}</DialogTitle>
        <form onSubmit={onSubmit} className="flex flex-col gap-3">
          <Input
            label={t('barbers_page.f_phone')}
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+995..."
            required
          />
          <div className="grid grid-cols-2 gap-3">
            <Input
              label={t('barbers_page.f_first_name')}
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              required
            />
            <Input
              label={t('barbers_page.f_last_name')}
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              required
            />
          </div>
          <Input
            label={t('barbers_page.f_email')}
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <Input
            label={t('barbers_page.f_password')}
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-ink">{t('barbers_page.f_bio')}</span>
            <textarea
              rows={3}
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              className="px-3.5 py-2.5 bg-surface-2 border border-line rounded-md text-[15px] text-ink focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/15"
            />
          </label>
          <p className="text-xs text-ink-muted">{t('barbers_page.photo_after_save_hint')}</p>
          <ErrorMessage error={create.error} />
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose} className="rounded-pill">
              {t('actions.cancel')}
            </Button>
            <Button
              type="submit"
              variant="accent"
              loading={create.isPending}
              className="rounded-pill"
            >
              {t('actions.create')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
