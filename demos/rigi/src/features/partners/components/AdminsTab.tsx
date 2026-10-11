import { zodResolver } from '@hookform/resolvers/zod'
import { Eye, EyeOff, UserPlus } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { fieldErrorsOf } from '@/api/client'
import { ActiveChip } from '@/components/status'
import { Button, ConfirmDialog, DataTable, DateText, Dialog, Field, IconButton, Input, Mono, type Column } from '@/components/ui'
import type { PartnerAdmin } from '@/types'

import { useCreatePortalAdmin, usePartnerAdmins, useSetPortalAdminActive } from '../api'
import { portalAdminSchema, type PortalAdminInput } from '../lib/schema'

function CreateAdminDialog({ partnerId, open, onOpenChange }: { partnerId: string; open: boolean; onOpenChange: (o: boolean) => void }) {
  const { t } = useTranslation('partners')
  const create = useCreatePortalAdmin(partnerId)
  const [show, setShow] = useState(false)
  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors },
  } = useForm<PortalAdminInput>({ resolver: zodResolver(portalAdminSchema), defaultValues: { username: '', fullName: '', email: '', password: '' } })
  const msg = (m?: string) => (m ? t(m) : undefined)

  const close = (next: boolean) => {
    onOpenChange(next)
    if (!next) {
      reset()
      setShow(false)
    }
  }

  const onSubmit = handleSubmit(async (values) => {
    try {
      const admin = await create.mutateAsync(values)
      toast.success(t('admins.created', { username: admin.username }))
      close(false)
    } catch (error) {
      const fields = fieldErrorsOf(error)
      const names = Object.keys(fields)
      if (names.length === 0) toast.error(error instanceof Error ? error.message : t('errors.generic'))
      for (const name of names) setError(name as keyof PortalAdminInput, { message: fields[name] })
    }
  })

  return (
    <Dialog
      open={open}
      onOpenChange={close}
      title={t('admins.createTitle')}
      description={t('admins.createDescription')}
      footer={
        <>
          <Button variant="ghost" onClick={() => close(false)} disabled={create.isPending}>{t('common:actions.cancel')}</Button>
          <Button type="submit" form="admin-form" loading={create.isPending}>{t('admins.create')}</Button>
        </>
      }
    >
      <form id="admin-form" onSubmit={onSubmit} noValidate className="space-y-4">
        <Field label={t('admins.username')} hint={t('admins.usernameHint')} required htmlFor="a-user" error={msg(errors.username?.message)}>
          <Input id="a-user" mono autoComplete="off" autoCapitalize="none" invalid={Boolean(errors.username)} {...register('username')} />
        </Field>
        <Field label={t('admins.fullName')} required htmlFor="a-name" error={msg(errors.fullName?.message)}>
          <Input id="a-name" autoComplete="off" invalid={Boolean(errors.fullName)} {...register('fullName')} />
        </Field>
        <Field label={t('admins.email')} hint={t('admins.emailHint')} htmlFor="a-email" error={msg(errors.email?.message)}>
          <Input id="a-email" type="email" autoComplete="off" invalid={Boolean(errors.email)} {...register('email')} />
        </Field>
        <Field label={t('admins.password')} hint={t('admins.passwordHint')} required htmlFor="a-pass" error={msg(errors.password?.message)}>
          <div className="flex gap-2">
            <Input id="a-pass" type={show ? 'text' : 'password'} autoComplete="new-password" invalid={Boolean(errors.password)} {...register('password')} />
            <IconButton
              label={show ? t('admins.hidePassword') : t('admins.showPassword')}
              icon={show ? <EyeOff /> : <Eye />}
              variant="outline"
              onClick={() => setShow((v) => !v)}
            />
          </div>
        </Field>
      </form>
    </Dialog>
  )
}

export function AdminsTab({ partnerId }: { partnerId: string }) {
  const { t } = useTranslation('partners')
  const admins = usePartnerAdmins(partnerId)
  const setActive = useSetPortalAdminActive(partnerId)
  const [creating, setCreating] = useState(false)
  const [target, setTarget] = useState<PartnerAdmin | null>(null)

  const confirm = () => {
    if (!target) return
    const next = !target.isActive
    setActive.mutate(
      { adminId: target.id, isActive: next },
      {
        onSuccess: () => {
          toast.success(t(next ? 'admins.reactivated' : 'admins.deactivated', { username: target.username }))
          setTarget(null)
        },
        onError: (e) => toast.error(e instanceof Error ? e.message : t('errors.generic')),
      },
    )
  }

  const columns: Column<PartnerAdmin>[] = [
    { key: 'username', header: t('admins.columns.username'), sortable: true, sortValue: (a) => a.username, hideBelow: 'sm', cell: (a) => <Mono>{a.username}</Mono> },
    {
      key: 'name',
      header: t('admins.columns.name'),
      sortable: true,
      sortValue: (a) => a.fullName.toLowerCase(),
      cell: (a) => (
        <span className="flex min-w-0 flex-col">
          <span className="truncate font-medium">{a.fullName}</span>
          <span className="truncate text-xs text-muted">{a.email ?? '-'}</span>
          <span className="truncate font-mono text-xs text-subtle sm:hidden">{a.username}</span>
        </span>
      ),
    },
    {
      key: 'lastLogin',
      header: t('admins.columns.lastLogin'),
      sortable: true,
      sortValue: (a) => a.lastLoginAt ?? '',
      hideBelow: 'sm',
      cell: (a) => (a.lastLoginAt ? <DateText value={a.lastLoginAt} withTime /> : <span className="text-subtle">{t('admins.neverSignedIn')}</span>),
    },
    { key: 'status', header: t('admins.columns.status'), cell: (a) => <ActiveChip active={a.isActive} /> },
    {
      key: 'actions',
      header: t('common:fields.actions'),
      align: 'right',
      cell: (a) => (
        <Button size="xs" variant={a.isActive ? 'destructive-ghost' : 'secondary'} onClick={() => setTarget(a)}>
          {a.isActive ? t('admins.deactivate') : t('admins.reactivate')}
        </Button>
      ),
    },
  ]

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-display text-base font-semibold">{t('admins.title')}</h3>
          <p className="text-[13px] text-muted">{t('admins.description')}</p>
        </div>
        <Button icon={<UserPlus />} onClick={() => setCreating(true)}>{t('admins.new')}</Button>
      </div>
      <DataTable
        columns={columns}
        rows={admins.data}
        getRowId={(a) => a.id}
        loading={admins.isLoading}
        error={admins.error}
        onRetry={() => admins.refetch()}
        pageSize={0}
        empty={{ title: t('admins.empty'), description: t('admins.emptyDescription') }}
      />
      <CreateAdminDialog partnerId={partnerId} open={creating} onOpenChange={setCreating} />
      <ConfirmDialog
        open={Boolean(target)}
        onOpenChange={(o) => !o && setTarget(null)}
        title={target ? t(target.isActive ? 'admins.deactivateTitle' : 'admins.reactivateTitle', { username: target.username }) : ''}
        description={target ? t(target.isActive ? 'admins.deactivateDescription' : 'admins.reactivateDescription') : undefined}
        confirmLabel={target?.isActive ? t('admins.deactivate') : t('admins.reactivate')}
        tone={target?.isActive ? 'danger' : 'primary'}
        pending={setActive.isPending}
        onConfirm={confirm}
      />
    </div>
  )
}
