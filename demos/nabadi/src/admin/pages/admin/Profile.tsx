import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { PageHeader } from '@/components/PageHeader';
import { Badge } from '@/components/Badge';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { ErrorMessage } from '@/components/ErrorMessage';
import { Input } from '@/components/Input';
import { useMe, type User } from '@/auth/hooks';
import { useChangePassword, useUpdateMe } from '@/features/admin/profile-hooks';

/** My Profile (spec §9.15) — the signed-in admin's own account and password. */
export function AdminProfile() {
  const { t } = useTranslation('admin');
  const { data: me } = useMe();

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow={t('page.profile')}
        title={t('page.profile')}
        subtitle={t('profile_page.subtitle')}
      />
      {me ? (
        <div className="grid lg:grid-cols-2 gap-6 items-start">
          {/* key: re-prime the form state if the cached user is replaced */}
          <ProfileCard key={me.id} user={me} />
          <PasswordCard />
        </div>
      ) : (
        <Card>
          <p role="status" aria-live="polite" className="text-ink-muted text-sm">
            {t('actions.loading')}
          </p>
        </Card>
      )}
    </div>
  );
}

function ProfileCard({ user }: { user: User }) {
  const { t } = useTranslation('admin');
  const update = useUpdateMe();

  const [firstName, setFirstName] = useState(user.first_name);
  const [lastName, setLastName] = useState(user.last_name);
  const [email, setEmail] = useState(user.email ?? '');

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    update.mutate({
      first_name: firstName.trim(),
      last_name: lastName.trim(),
      email: email.trim() || null,
    });
  };

  return (
    <Card>
      <h2 className="font-display text-xl text-ink tracking-tight mb-4">
        {t('profile_page.section_profile')}
      </h2>
      <form onSubmit={onSubmit} className="flex flex-col gap-3">
        <div className="flex items-center gap-2 text-sm text-ink-muted">
          <span>{t('profile_page.role_label')}:</span>
          <Badge variant="accent">{t(`users_page.role_${user.role}`)}</Badge>
        </div>
        <Input
          label={t('profile_page.phone_label')}
          value={user.phone}
          hint={t('profile_page.phone_hint')}
          dir="ltr"
          disabled
        />
        <div className="grid grid-cols-2 gap-3">
          <Input
            label={t('profile_page.f_first_name')}
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            required
          />
          <Input
            label={t('profile_page.f_last_name')}
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            required
          />
        </div>
        <Input
          label={t('profile_page.f_email')}
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <ErrorMessage error={update.error} />
        <div className="flex justify-end mt-1">
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
    </Card>
  );
}

function PasswordCard() {
  const { t } = useTranslation('admin');
  const change = useChangePassword();

  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [confirmError, setConfirmError] = useState<string | undefined>();

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const mismatch = next !== confirm;
    setConfirmError(mismatch ? 'password_mismatch' : undefined);
    if (mismatch) return;
    try {
      await change.mutateAsync({ old_password: current, new_password: next });
      setCurrent('');
      setNext('');
      setConfirm('');
    } catch {
      /* credentials_invalid / password_weak surfaced via toast + inline */
    }
  };

  return (
    <Card>
      <h2 className="font-display text-xl text-ink tracking-tight mb-4">
        {t('profile_page.section_password')}
      </h2>
      <form onSubmit={onSubmit} className="flex flex-col gap-3">
        <p className="text-sm text-ink-muted">{t('profile_page.password_hint')}</p>
        <Input
          label={t('profile_page.f_current_password')}
          type="password"
          value={current}
          onChange={(e) => setCurrent(e.target.value)}
          autoComplete="current-password"
          required
        />
        <Input
          label={t('profile_page.f_new_password')}
          type="password"
          value={next}
          onChange={(e) => setNext(e.target.value)}
          autoComplete="new-password"
          required
        />
        <Input
          label={t('profile_page.f_confirm_password')}
          type="password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          autoComplete="new-password"
          error={confirmError}
          required
        />
        <ErrorMessage error={change.error} />
        <div className="flex justify-end mt-1">
          <Button
            type="submit"
            variant="accent"
            loading={change.isPending}
            className="rounded-pill"
          >
            {t('profile_page.change_password_submit')}
          </Button>
        </div>
      </form>
    </Card>
  );
}
