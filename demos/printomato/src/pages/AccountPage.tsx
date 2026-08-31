import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { KeyRound, UserRound } from 'lucide-react'

import { cn } from '@/lib/cn'
import { ApiError } from '@/lib/api'
import { formatDateTime } from '@/lib/format'
import { useChangePassword, useSession, useUpdateProfile } from '@/lib/queries'
import { useToast } from '@/components/ui/Toast'
import { Button, PageHeader, Panel, PanelHeader } from '@/components/ui/primitives'
import { Field, Input } from '@/components/ui/form'

type Tab = 'profile' | 'password'

export function AccountPage() {
  const { t } = useTranslation()
  const [params, setParams] = useSearchParams()
  const tab: Tab = params.get('tab') === 'password' ? 'password' : 'profile'

  return (
    <>
      <PageHeader title={t('account.title')} subtitle={t('account.subtitle')} />

      <div className="mb-4 flex items-center gap-1 rounded-control border border-hairline bg-white/3 p-0.5 sm:w-fit">
        {(
          [
            { id: 'profile' as const, label: t('account.profile'), icon: UserRound },
            { id: 'password' as const, label: t('account.passwordTitle'), icon: KeyRound },
          ]
        ).map((entry) => (
          <button
            key={entry.id}
            type="button"
            onClick={() => setParams(entry.id === 'profile' ? {} : { tab: entry.id }, { replace: true })}
            className={cn(
              'flex flex-1 items-center justify-center gap-2 rounded-[7px] px-4 py-2 text-sm font-medium transition-colors sm:flex-none',
              tab === entry.id ? 'bg-gold/15 text-gold' : 'text-ink-faint hover:text-ink-muted',
            )}
          >
            <entry.icon className="size-4" />
            {entry.label}
          </button>
        ))}
      </div>

      <div className="max-w-2xl">{tab === 'profile' ? <ProfileForm /> : <PasswordForm />}</div>
    </>
  )
}

/* ------------------------------------------------------------- ProfileForm */

function ProfileForm() {
  const { t } = useTranslation()
  const toast = useToast()
  const { data: user } = useSession()
  const save = useUpdateProfile()

  const [form, setForm] = useState({ username: '', email: '', first_name: '', last_name: '' })

  useEffect(() => {
    if (user) {
      setForm({
        username: user.username,
        email: user.email ?? '',
        first_name: user.first_name ?? '',
        last_name: user.last_name ?? '',
      })
    }
  }, [user])

  const error = save.error instanceof ApiError ? save.error : null

  const onSubmit = (event: React.FormEvent) => {
    event.preventDefault()
    save.mutate(form, { onSuccess: () => toast.success(t('account.profileSaved')) })
  }

  return (
    <Panel className="overflow-hidden">
      <PanelHeader title={t('account.profile')} icon={<UserRound className="size-4" />} />
      <form onSubmit={onSubmit} className="flex flex-col gap-4 p-5" noValidate>
        <div className="flex items-center gap-4 border-b border-hairline pb-5">
          <span className="grid size-14 shrink-0 place-items-center rounded-full border border-gold/30 bg-gold/12 text-lg font-semibold text-gold">
            {user?.initials ?? '·'}
          </span>
          <div className="min-w-0">
            <p className="truncate text-base font-semibold text-ink">{user?.full_name ?? '—'}</p>
            <p className="numeral truncate text-xs text-ink-faint">
              {t('account.lastSignIn')}: {user?.last_login ? formatDateTime(user.last_login) : t('common.never')}
            </p>
          </div>
        </div>

        {error && Object.keys(error.fieldErrors).length === 0 && (
          <p role="alert" className="rounded-control border border-danger/30 bg-danger/8 px-3.5 py-2.5 text-sm text-danger">
            {error.message}
          </p>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t('account.username')} required error={error?.fieldError('username')}>
            <Input
              value={form.username}
              onChange={(event) => setForm({ ...form, username: event.target.value })}
              required
              invalid={Boolean(error?.fieldError('username'))}
            />
          </Field>
          <Field label={t('account.email')} error={error?.fieldError('email')}>
            <Input
              type="email"
              value={form.email}
              onChange={(event) => setForm({ ...form, email: event.target.value })}
              invalid={Boolean(error?.fieldError('email'))}
            />
          </Field>
          <Field label={t('account.firstName')} error={error?.fieldError('first_name')}>
            <Input
              value={form.first_name}
              onChange={(event) => setForm({ ...form, first_name: event.target.value })}
            />
          </Field>
          <Field label={t('account.lastName')} error={error?.fieldError('last_name')}>
            <Input
              value={form.last_name}
              onChange={(event) => setForm({ ...form, last_name: event.target.value })}
            />
          </Field>
        </div>

        <div className="flex justify-end pt-1">
          <Button type="submit" variant="primary" loading={save.isPending}>
            {save.isPending ? t('common.saving') : t('common.save')}
          </Button>
        </div>
      </form>
    </Panel>
  )
}

/* ------------------------------------------------------------ PasswordForm */

function PasswordForm() {
  const { t } = useTranslation()
  const toast = useToast()
  const change = useChangePassword()

  const [form, setForm] = useState({ old_password: '', new_password1: '', new_password2: '' })
  const error = change.error instanceof ApiError ? change.error : null

  const onSubmit = (event: React.FormEvent) => {
    event.preventDefault()
    change.mutate(form, {
      onSuccess: () => {
        toast.success(t('account.passwordSaved'))
        setForm({ old_password: '', new_password1: '', new_password2: '' })
      },
    })
  }

  return (
    <Panel className="overflow-hidden">
      <PanelHeader title={t('account.passwordTitle')} icon={<KeyRound className="size-4" />} />
      <form onSubmit={onSubmit} className="flex flex-col gap-4 p-5" noValidate>
        <p className="text-sm text-ink-faint">{t('account.passwordSubtitle')}</p>

        {error && Object.keys(error.fieldErrors).length === 0 && (
          <p role="alert" className="rounded-control border border-danger/30 bg-danger/8 px-3.5 py-2.5 text-sm text-danger">
            {error.message}
          </p>
        )}

        <Field label={t('account.currentPassword')} required error={error?.fieldError('old_password')}>
          <Input
            type="password"
            autoComplete="current-password"
            value={form.old_password}
            onChange={(event) => setForm({ ...form, old_password: event.target.value })}
            required
            invalid={Boolean(error?.fieldError('old_password'))}
          />
        </Field>

        <Field label={t('account.newPassword')} required error={error?.fieldError('new_password1')}>
          <Input
            type="password"
            autoComplete="new-password"
            value={form.new_password1}
            onChange={(event) => setForm({ ...form, new_password1: event.target.value })}
            required
            invalid={Boolean(error?.fieldError('new_password1'))}
          />
        </Field>

        <Field label={t('account.confirmPassword')} required error={error?.fieldError('new_password2')}>
          <Input
            type="password"
            autoComplete="new-password"
            value={form.new_password2}
            onChange={(event) => setForm({ ...form, new_password2: event.target.value })}
            required
            invalid={Boolean(error?.fieldError('new_password2'))}
          />
        </Field>

        <div className="flex justify-end pt-1">
          <Button type="submit" variant="primary" loading={change.isPending}>
            {change.isPending ? t('common.saving') : t('common.save')}
          </Button>
        </div>
      </form>
    </Panel>
  )
}
