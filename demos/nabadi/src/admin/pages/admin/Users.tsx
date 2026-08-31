import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, UserCog } from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';
import { Badge } from '@/components/Badge';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { EmptyState } from '@/components/EmptyState';
import { ErrorMessage } from '@/components/ErrorMessage';
import { Input } from '@/components/Input';
import { Pager } from '@/components/Pager';
import { SearchInput } from '@/components/SearchInput';
import { SectionError } from '@/components/SectionError';
import { Dialog, DialogContent, DialogFooter, DialogTitle } from '@/components/Dialog';
import { ConfirmDialog } from '@/features/admin/components/ConfirmDialog';
import {
  STAFF_ROLES,
  useAdminActivateUser,
  useAdminCreateUser,
  useAdminDeactivateUser,
  useAdminResetUserPassword,
  useAdminUpdateUser,
  useAdminUsers,
  type AdminStaffUser,
  type StaffRole,
  type UsersFilters,
} from '@/features/admin/users-hooks';
import { useMe } from '@/auth/hooks';
import { formatTbilisiDate } from '@/lib/datetime';
import { pageCount, usePageState } from '@/lib/paginated';
import { normalizePhoneE164 } from '@/lib/phone';
import { useDebouncedValue } from '@/lib/useDebouncedValue';

const ROLE_BADGE: Record<StaffRole, 'ink' | 'outline'> = {
  admin: 'ink',
  barber: 'outline',
};

const SELECT_CLS =
  'h-11 px-3.5 bg-surface-2 border border-line rounded-md text-[15px] focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/15';

function fullName(u: AdminStaffUser): string {
  return `${u.first_name} ${u.last_name}`.trim();
}

export function AdminUsers() {
  const { t } = useTranslation('admin');
  const [search, setSearch] = useState('');
  const [role, setRole] = useState<StaffRole | ''>('');
  const [active, setActive] = useState<'' | 'true' | 'false'>('');
  const debouncedSearch = useDebouncedValue(search);

  const filters: UsersFilters = {
    search: debouncedSearch || undefined,
    role: role || undefined,
    active: active || undefined,
  };
  const [page, setPage] = usePageState(JSON.stringify(filters));
  const users = useAdminUsers(filters, page);

  const [creating, setCreating] = useState(false);
  const items: AdminStaffUser[] = users.data?.results ?? [];
  const pages = pageCount(users.data?.count ?? 0);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow={t('page.users')}
        title={t('page.users')}
        subtitle={t('users_page.subtitle')}
        actions={
          <Button onClick={() => setCreating(true)} variant="accent" className="rounded-pill">
            <Plus className="h-4 w-4" />
            {t('users_page.new')}
          </Button>
        }
      />

      <Card>
        <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-3">
          <SearchInput
            label={t('actions.search')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('users_page.search_placeholder')}
          />
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-ink">{t('users_page.f_role')}</span>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as StaffRole | '')}
              className={SELECT_CLS}
            >
              <option value="">{t('users_page.all_roles')}</option>
              {STAFF_ROLES.map((r) => (
                <option key={r} value={r}>
                  {t(`users_page.role_${r}`)}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-ink">{t('users_page.f_active')}</span>
            <select
              value={active}
              onChange={(e) => setActive(e.target.value as '' | 'true' | 'false')}
              className={SELECT_CLS}
            >
              <option value="">{t('users_page.filter_all')}</option>
              <option value="true">{t('users_page.filter_active')}</option>
              <option value="false">{t('users_page.filter_inactive')}</option>
            </select>
          </label>
        </div>
      </Card>

      {users.isError ? (
        <SectionError error={users.error} onRetry={() => users.refetch()} />
      ) : users.isLoading ? (
        <Card>
          <p role="status" aria-live="polite" className="text-ink-muted text-sm">
            {t('actions.loading')}
          </p>
        </Card>
      ) : items.length === 0 ? (
        <EmptyState icon={<UserCog className="h-5 w-5" />} title={t('users_page.empty_title')} />
      ) : (
        <>
          <UsersTable items={items} />
          <Pager page={page} pageCount={pages} onPageChange={setPage} />
        </>
      )}

      <CreateUserModal open={creating} onClose={() => setCreating(false)} />
    </div>
  );
}

function UsersTable({ items }: { items: AdminStaffUser[] }) {
  const { t } = useTranslation('admin');
  const { data: me } = useMe();
  const [editing, setEditing] = useState<AdminStaffUser | null>(null);
  const [resetting, setResetting] = useState<AdminStaffUser | null>(null);
  const [toggling, setToggling] = useState<AdminStaffUser | null>(null);

  const cols = ['col_name', 'col_phone', 'col_role', 'col_status', 'col_joined'] as const;

  return (
    <div className="overflow-x-auto border border-line rounded-2xl bg-surface">
      <table className="w-full text-sm">
        <thead className="border-b border-line bg-bg/50">
          <tr className="text-left text-ink-muted">
            {cols.map((c) => (
              <th
                key={c}
                scope="col"
                className="px-4 py-3 font-medium text-xs uppercase tracking-[0.1em]"
              >
                {t(`users_page.${c}`)}
              </th>
            ))}
            <th scope="col" className="px-4 py-3 w-56">
              <span className="sr-only">{t('actions.row_actions_label')}</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {items.map((u) => {
            const isSelf = me?.id === u.id;
            return (
              <tr
                key={u.id}
                className="border-b border-line last:border-b-0 hover:bg-bg/30 transition"
              >
                <td className="px-4 py-3 align-middle">
                  <div className="flex items-center gap-2">
                    <span className="text-ink font-medium">{fullName(u)}</span>
                    {isSelf && <Badge variant="accent">{t('users_page.you_tag')}</Badge>}
                  </div>
                  <div className="text-xs text-ink-muted mt-0.5">
                    {u.email ?? t('users_page.no_email')}
                  </div>
                </td>
                <td className="px-4 py-3 align-middle tabular-nums" dir="ltr">
                  {u.phone}
                </td>
                <td className="px-4 py-3 align-middle">
                  <Badge variant={ROLE_BADGE[u.role]}>{t(`users_page.role_${u.role}`)}</Badge>
                </td>
                <td className="px-4 py-3 align-middle">
                  <Badge variant={u.is_active ? 'success' : 'danger'}>
                    {u.is_active ? t('users_page.active') : t('users_page.inactive')}
                  </Badge>
                </td>
                <td className="px-4 py-3 align-middle text-ink-muted text-xs tabular-nums">
                  {formatTbilisiDate(u.date_joined)}
                </td>
                <td className="px-4 py-3 align-middle text-right">
                  <div className="flex gap-2 justify-end">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setEditing(u)}
                      className="rounded-pill"
                    >
                      {t('actions.edit')}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setResetting(u)}
                      className="rounded-pill"
                    >
                      {t('users_page.reset_password')}
                    </Button>
                    {!isSelf && (
                      <Button
                        variant={u.is_active ? 'danger' : 'secondary'}
                        size="sm"
                        onClick={() => setToggling(u)}
                        className="rounded-pill"
                      >
                        {u.is_active ? t('users_page.deactivate') : t('users_page.activate')}
                      </Button>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <EditUserModal user={editing} onClose={() => setEditing(null)} />
      <ResetPasswordModal user={resetting} onClose={() => setResetting(null)} />
      <ToggleActiveDialog user={toggling} onClose={() => setToggling(null)} />
    </div>
  );
}

function RoleSelect({
  value,
  onChange,
}: {
  value: StaffRole;
  onChange: (role: StaffRole) => void;
}) {
  const { t } = useTranslation('admin');
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-sm font-medium text-ink">{t('users_page.f_role')}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as StaffRole)}
        className={SELECT_CLS}
      >
        {STAFF_ROLES.map((r) => (
          <option key={r} value={r}>
            {t(`users_page.role_${r}`)}
          </option>
        ))}
      </select>
      {value === 'barber' && (
        <span className="text-xs text-ink-muted">{t('users_page.barber_profile_hint')}</span>
      )}
    </label>
  );
}

function CreateUserModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useTranslation('admin');
  const create = useAdminCreateUser();

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<StaffRole>('barber');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [phoneError, setPhoneError] = useState<string | undefined>();
  const [confirmError, setConfirmError] = useState<string | undefined>();

  const reset = () => {
    setFirstName('');
    setLastName('');
    setPhone('');
    setEmail('');
    setRole('barber');
    setPassword('');
    setConfirm('');
    setPhoneError(undefined);
    setConfirmError(undefined);
    create.reset();
  };

  const close = () => {
    reset();
    onClose();
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // Client-side gate: E.164 phone (lib/phone.ts) + matching passwords.
    const normalized = normalizePhoneE164(phone);
    setPhoneError(normalized ? undefined : 'phone_invalid');
    const mismatch = password !== confirm;
    setConfirmError(mismatch ? 'password_mismatch' : undefined);
    if (!normalized || mismatch) return;

    try {
      await create.mutateAsync({
        phone: normalized,
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        email: email.trim() || undefined,
        role,
        password,
      });
      close();
    } catch {
      /* surfaced via toast + inline ErrorMessage */
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && close()}>
      <DialogContent>
        <DialogTitle>{t('users_page.modal_new_title')}</DialogTitle>
        <form onSubmit={onSubmit} className="flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-3">
            <Input
              label={t('users_page.f_first_name')}
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              required
            />
            <Input
              label={t('users_page.f_last_name')}
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              required
            />
          </div>
          <Input
            label={t('users_page.f_phone')}
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+995 5XX XX XX XX"
            error={phoneError}
            dir="ltr"
            required
          />
          <Input
            label={t('users_page.f_email')}
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <RoleSelect value={role} onChange={setRole} />
          <Input
            label={t('users_page.f_password')}
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
            required
          />
          <Input
            label={t('users_page.f_password_confirm')}
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            autoComplete="new-password"
            error={confirmError}
            required
          />
          <ErrorMessage error={create.error} />
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={close} className="rounded-pill">
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

function EditUserModal({ user, onClose }: { user: AdminStaffUser | null; onClose: () => void }) {
  const { t } = useTranslation('admin');
  const update = useAdminUpdateUser();

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<StaffRole>('barber');
  const [trackedId, setTrackedId] = useState<number | null>(null);

  // Re-sync form when the target row changes (tracked-state idiom).
  if (user && user.id !== trackedId) {
    setTrackedId(user.id);
    setFirstName(user.first_name);
    setLastName(user.last_name);
    setEmail(user.email ?? '');
    setRole(user.role);
    update.reset();
  }

  const close = () => {
    setTrackedId(null);
    onClose();
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    try {
      await update.mutateAsync({
        id: user.id,
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        email: email.trim() || null,
        role,
      });
      close();
    } catch {
      /* last_admin etc. surfaced via toast + inline ErrorMessage */
    }
  };

  return (
    <Dialog open={user !== null} onOpenChange={(o) => !o && close()}>
      <DialogContent>
        <DialogTitle>{t('users_page.modal_edit_title')}</DialogTitle>
        <form onSubmit={onSubmit} className="flex flex-col gap-3">
          <p className="text-sm text-ink-muted tabular-nums" dir="ltr">
            {user?.phone}
          </p>
          <div className="grid grid-cols-2 gap-3">
            <Input
              label={t('users_page.f_first_name')}
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              required
            />
            <Input
              label={t('users_page.f_last_name')}
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              required
            />
          </div>
          <Input
            label={t('users_page.f_email')}
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <RoleSelect value={role} onChange={setRole} />
          <ErrorMessage error={update.error} />
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={close} className="rounded-pill">
              {t('actions.cancel')}
            </Button>
            <Button
              type="submit"
              variant="accent"
              loading={update.isPending}
              className="rounded-pill"
            >
              {t('actions.save')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ResetPasswordModal({
  user,
  onClose,
}: {
  user: AdminStaffUser | null;
  onClose: () => void;
}) {
  const { t } = useTranslation('admin');
  const reset = useAdminResetUserPassword();

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [confirmError, setConfirmError] = useState<string | undefined>();

  const close = () => {
    setPassword('');
    setConfirm('');
    setConfirmError(undefined);
    reset.reset();
    onClose();
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    const mismatch = password !== confirm;
    setConfirmError(mismatch ? 'password_mismatch' : undefined);
    if (mismatch) return;
    try {
      await reset.mutateAsync({ id: user.id, new_password: password });
      close();
    } catch {
      /* password_weak etc. surfaced via toast + inline ErrorMessage */
    }
  };

  return (
    <Dialog open={user !== null} onOpenChange={(o) => !o && close()}>
      <DialogContent>
        <DialogTitle>{t('users_page.reset_title')}</DialogTitle>
        <form onSubmit={onSubmit} className="flex flex-col gap-3">
          <p className="text-sm text-ink-muted">
            {t('users_page.reset_hint', { name: user ? fullName(user) : '' })}
          </p>
          <Input
            label={t('users_page.f_new_password')}
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
            required
          />
          <Input
            label={t('users_page.f_new_password_confirm')}
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            autoComplete="new-password"
            error={confirmError}
            required
          />
          <ErrorMessage error={reset.error} />
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={close} className="rounded-pill">
              {t('actions.cancel')}
            </Button>
            <Button
              type="submit"
              variant="accent"
              loading={reset.isPending}
              className="rounded-pill"
            >
              {t('users_page.reset_submit')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ToggleActiveDialog({
  user,
  onClose,
}: {
  user: AdminStaffUser | null;
  onClose: () => void;
}) {
  const { t } = useTranslation('admin');
  const activate = useAdminActivateUser();
  const deactivate = useAdminDeactivateUser();
  const pending = activate.isPending || deactivate.isPending;
  const deactivating = user?.is_active ?? false;

  const onConfirm = async () => {
    if (!user || pending) return;
    try {
      if (deactivating) {
        // cannot_deactivate_self comes back as a toast via mutation feedback.
        await deactivate.mutateAsync(user.id);
      } else {
        await activate.mutateAsync(user.id);
      }
      onClose();
    } catch {
      /* surfaced via toast */
    }
  };

  const name = user ? fullName(user) : '';
  return (
    <ConfirmDialog
      open={user !== null}
      onOpenChange={(o) => !o && !pending && onClose()}
      title={
        deactivating
          ? t('users_page.deactivate_confirm', { name })
          : t('users_page.activate_confirm', { name })
      }
      body={deactivating ? t('users_page.deactivate_body') : t('users_page.activate_body')}
      confirmLabel={deactivating ? t('users_page.deactivate') : t('users_page.activate')}
      cancelLabel={t('actions.cancel')}
      destructive={deactivating}
      loading={pending}
      onConfirm={onConfirm}
    />
  );
}
