import { MoreHorizontal, UserPlus } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'

import {
  Avatar,
  Badge,
  Button,
  ConfirmDialog,
  DataTable,
  Dialog,
  Drawer,
  DropdownMenu,
  EmptyState,
  Field,
  IconButton,
  Input,
  SecretOnceDialog,
  Select,
  Switch,
  toast,
  type Column,
} from '@/components/ui'
import { useFormat } from '@/lib/format'
import type { Tenant, TenantUser } from '@/types'
import { useErrorText, useTenantUserMutations, useTenantUsers } from '../api'

/** Add or edit one workspace user. Mounted only while open. */
function UserFormDialog({ tenant, user, onOpenChange, onSecret }: {
  tenant: Tenant
  user: TenantUser | null
  onOpenChange: (open: boolean) => void
  onSecret: (title: string, secret: string) => void
}) {
  const { t, i18n } = useTranslation('consolePlatform')
  const errorText = useErrorText()
  const { add, update } = useTenantUserMutations(tenant.id)
  const [username, setUsername] = useState(user?.username ?? '')
  const [displayName, setDisplayName] = useState(user?.display_name ?? '')
  const [role, setRole] = useState<TenantUser['role']>(user?.role ?? 'member')
  const [password, setPassword] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const busy = add.isPending || update.isPending

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    const next: Record<string, string> = {}
    if (!user) {
      if (!username.trim()) next.username = 'required'
      else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(username.trim())) next.username = 'email_invalid'
      if (password && password.length < 8) next.password = 'password_short'
    }
    if (!displayName.trim()) next.display_name = 'required'
    if (Object.keys(next).length) {
      setErrors(Object.fromEntries(Object.entries(next).map(([k, code]) => [k, t(`errors.${code}`)])))
      return
    }
    try {
      if (user) {
        await update.mutateAsync({ id: user.id, display_name: displayName, role })
        toast.success(t('tenantUsers.toast.updated'))
      } else {
        const result = await add.mutateAsync({ username, display_name: displayName, role, password: password || undefined })
        toast.success(t('tenantUsers.toast.added', { name: result.user.display_name }))
        onSecret(t('tenantUsers.secret.addedTitle', { name: result.user.display_name }), result.password)
      }
      onOpenChange(false)
    } catch (error) {
      const fields = errorText.fields(error)
      setErrors(Object.keys(fields).length ? fields : { form: errorText.text(error) })
    }
  }

  const label = i18n.language === 'ka' ? tenant.name_ka : tenant.name
  return (
    <Dialog
      open
      onOpenChange={onOpenChange}
      locked={busy}
      title={user ? t('tenantUsers.form.editTitle', { name: user.display_name }) : t('tenantUsers.form.addTitle', { name: label })}
      footer={
        <>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={busy}>
            {t('actions.cancel')}
          </Button>
          <Button type="submit" form="tenant-user-form" variant="primary" loading={busy}>
            {user ? t('tenantUsers.form.save') : t('tenantUsers.form.add')}
          </Button>
        </>
      }
    >
      <form id="tenant-user-form" onSubmit={(e) => void submit(e)} className="space-y-4" noValidate>
        {errors.form ? <p role="alert" className="text-sm text-danger">{errors.form}</p> : null}
        <Field label={t('tenantUsers.form.username')} error={errors.username}>
          <Input type="email" value={username} onChange={(e) => setUsername(e.target.value)} disabled={Boolean(user)} autoFocus={!user} />
        </Field>
        <Field label={t('tenantUsers.form.displayName')} error={errors.display_name}>
          <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} maxLength={80} />
        </Field>
        <Field label={t('tenantUsers.form.role')} hint={t('tenantUsers.roleHint')} error={errors.role}>
          <Select
            value={role}
            onValueChange={(v) => setRole(v as TenantUser['role'])}
            options={[
              { value: 'owner', label: t('tenantUsers.roles.owner') },
              { value: 'member', label: t('tenantUsers.roles.member') },
            ]}
          />
        </Field>
        {!user ? (
          <Field label={t('tenantUsers.form.password')} hint={t('tenantUsers.form.passwordHint')} error={errors.password} optional>
            <Input type="text" mono autoComplete="off" value={password} onChange={(e) => setPassword(e.target.value)} />
          </Field>
        ) : null}
      </form>
    </Dialog>
  )
}

/** The users of one workspace: add, edit, activate, reset password, delete. */
export function TenantUsersDrawer({ tenant, onClose }: { tenant: Tenant; onClose: () => void }) {
  const { t, i18n } = useTranslation('consolePlatform')
  const f = useFormat()
  const errorText = useErrorText()
  const users = useTenantUsers(tenant.id)
  const mutations = useTenantUserMutations(tenant.id)
  const [form, setForm] = useState<{ user: TenantUser | null } | null>(null)
  const [resetting, setResetting] = useState<TenantUser | null>(null)
  const [deleting, setDeleting] = useState<TenantUser | null>(null)
  const [secret, setSecret] = useState<{ title: string; value: string } | null>(null)

  const setActive = (user: TenantUser, is_active: boolean) =>
    mutations.update.mutate(
      { id: user.id, is_active },
      { onError: (error) => toast.error(errorText.text(error)) },
    )

  const columns: Column<TenantUser>[] = [
    {
      key: 'display_name',
      header: t('tenantUsers.columns.user'),
      sortable: true,
      cell: (u) => (
        <div className="flex min-w-0 items-center gap-2.5">
          <Avatar name={u.display_name} size={28} />
          <div className="min-w-0">
            <div className="truncate font-medium text-ink">{u.display_name}</div>
            <div className="truncate font-mono text-xs text-muted">{u.username}</div>
          </div>
        </div>
      ),
    },
    {
      key: 'role',
      header: t('tenantUsers.columns.role'),
      sortable: true,
      cell: (u) => <Badge tone={u.role === 'owner' ? 'accent' : 'neutral'}>{t(`tenantUsers.roles.${u.role}`)}</Badge>,
    },
    {
      key: 'is_active',
      header: t('tenantUsers.columns.status'),
      sortable: (u) => Number(u.is_active),
      cell: (u) => (
        <Switch
          size="sm"
          checked={u.is_active}
          onCheckedChange={(v) => setActive(u, v)}
          aria-label={`${u.display_name}: ${u.is_active ? t('tenantUsers.active') : t('tenantUsers.inactive')}`}
        />
      ),
    },
    { key: 'created_at', header: t('tenantUsers.columns.created'), sortable: true, hideBelow: 'md', cell: (u) => f.date(u.created_at) },
    {
      key: 'last_login_at',
      header: t('tenantUsers.columns.lastLogin'),
      sortable: (u) => (u.last_login_at ? Date.parse(u.last_login_at) : 0),
      hideBelow: 'md',
      cell: (u) => (u.last_login_at ? f.relative(u.last_login_at) : <span className="text-muted">{t('common.never')}</span>),
    },
    {
      key: 'actions',
      header: <span className="sr-only">{t('actions.edit')}</span>,
      align: 'right',
      width: 56,
      cell: (u) => (
        <DropdownMenu
          align="end"
          trigger={<IconButton label={t('actions.more', { name: u.display_name })} icon={<MoreHorizontal />} size="sm" />}
          items={[
            { label: t('tenantUsers.menu.edit'), onSelect: () => setForm({ user: u }) },
            { label: t('tenantUsers.menu.resetPassword'), onSelect: () => setResetting(u) },
            { label: u.is_active ? t('tenantUsers.menu.deactivate') : t('tenantUsers.menu.activate'), onSelect: () => setActive(u, !u.is_active) },
            { type: 'separator' },
            { label: t('tenantUsers.menu.delete'), danger: true, onSelect: () => setDeleting(u) },
          ]}
        />
      ),
    },
  ]

  const tenantName = i18n.language === 'ka' ? tenant.name_ka : tenant.name
  return (
    <>
      <Drawer
        open
        onOpenChange={(open) => !open && onClose()}
        width={720}
        title={t('tenantUsers.title', { name: tenantName })}
        description={t('tenantUsers.description')}
      >
        <div className="mb-4 flex justify-end">
          <Button variant="primary" icon={<UserPlus />} onClick={() => setForm({ user: null })}>
            {t('tenantUsers.add')}
          </Button>
        </div>
        {users.isError ? (
          <p role="alert" className="text-sm text-danger">
            {t('errors.loadFailed')}{' '}
            <button type="button" className="underline" onClick={() => void users.refetch()}>
              {t('actions.retry')}
            </button>
          </p>
        ) : (
          <DataTable
            rows={users.data}
            loading={users.isLoading}
            columns={columns}
            rowKey={(u) => u.id}
            pageSize={0}
            dense
            empty={<EmptyState compact title={t('tenantUsers.emptyTitle')} body={t('tenantUsers.emptyBody')} />}
          />
        )}
      </Drawer>

      {form ? (
        <UserFormDialog
          tenant={tenant}
          user={form.user}
          onOpenChange={(open) => !open && setForm(null)}
          onSecret={(title, value) => setSecret({ title, value })}
        />
      ) : null}

      <ConfirmDialog
        open={resetting !== null}
        onOpenChange={(open) => !open && setResetting(null)}
        title={t('tenantUsers.reset.title', { name: resetting?.display_name ?? '' })}
        body={t('tenantUsers.reset.body')}
        confirmLabel={t('tenantUsers.reset.confirm')}
        onConfirm={async () => {
          if (!resetting) return
          try {
            const result = await mutations.resetPassword.mutateAsync(resetting.id)
            toast.success(t('tenantUsers.toast.resetDone'))
            setSecret({ title: t('tenantUsers.secret.resetTitle', { name: resetting.display_name }), value: result.password })
            setResetting(null)
          } catch (error) {
            toast.error(errorText.text(error))
          }
        }}
      />

      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
        danger
        title={t('tenantUsers.delete.title', { name: deleting?.display_name ?? '' })}
        body={t('tenantUsers.delete.body')}
        confirmLabel={t('tenantUsers.delete.confirm')}
        onConfirm={async () => {
          if (!deleting) return
          try {
            await mutations.remove.mutateAsync(deleting.id)
            toast.success(t('tenantUsers.toast.deleted', { name: deleting.display_name }))
            setDeleting(null)
          } catch (error) {
            toast.error(errorText.text(error))
            setDeleting(null)
          }
        }}
      />

      <SecretOnceDialog
        open={secret !== null}
        onOpenChange={(open) => !open && setSecret(null)}
        title={secret?.title}
        secret={secret?.value ?? null}
        label={t('tenantUsers.secret.label')}
        note={t('tenantUsers.secret.note')}
      />
    </>
  )
}
