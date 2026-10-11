/** Create/Edit, Reset password, Enable/Disable and Grant super admin modals. */
import { zodResolver } from '@hookform/resolvers/zod'
import { ShieldAlert } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { z } from 'zod'

import { Alert, Button, ConfirmDialog, Dialog, Field, Input, Select } from '@/components/ui'
import { fieldErrors } from '@/lib/api'
import { useLocalized } from '@/lib/localized'
import { toast } from '@/lib/toast'
import type { Role, User } from '@/types'

import { useCreateUser, useGrantSuperAdmin, useResetPassword, useSetActive, useUpdateUser } from '../api'
import { EMAIL_RE, EXTENSION_RE, MIN_PASSWORD, USERNAME_RE, assignableRoles, canChangeRole } from '../rules'
import { useErrorText } from './shared'

type Actor = { id: string; role: Role }

const ROLES = ['super_admin', 'admin', 'supervisor', 'operator'] as const

function buildSchema(mode: 'create' | 'edit') {
  const base = z.object({
    username: z.string().trim().min(1, 'errors.usernameRequired').regex(USERNAME_RE, 'errors.usernameInvalid'),
    nameEn: z.string().trim().min(1, 'errors.nameRequired'),
    nameKa: z.string().trim(),
    email: z.string().trim().min(1, 'errors.emailRequired').regex(EMAIL_RE, 'errors.emailInvalid'),
    role: z.enum(ROLES),
    sipExtension: z.string().trim().refine((v) => v === '' || EXTENSION_RE.test(v), 'errors.extensionInvalid'),
    password: z.string(),
    confirmPassword: z.string(),
  })
  if (mode === 'edit') return base
  return base.superRefine((v, ctx) => {
    if (!v.password) ctx.addIssue({ code: 'custom', path: ['password'], message: 'errors.passwordRequired' })
    else if (v.password.length < MIN_PASSWORD) ctx.addIssue({ code: 'custom', path: ['password'], message: 'errors.passwordShort' })
    if (v.password && v.confirmPassword !== v.password) ctx.addIssue({ code: 'custom', path: ['confirmPassword'], message: 'errors.passwordMismatch' })
  })
}

type FormValues = z.infer<ReturnType<typeof buildSchema>>

/* ------------------------------------------------------------ create / edit */

export function UserFormDialog({ open, onOpenChange, actor, user }: { open: boolean; onOpenChange: (open: boolean) => void; actor: Actor; user: User | null }) {
  const { t } = useTranslation('people')
  const tc = useTranslation().t
  const l = useLocalized()
  const errs = useErrorText()
  const mode = user ? 'edit' : 'create'
  const create = useCreateUser()
  const update = useUpdateUser()
  const roleLocked = user ? !canChangeRole(actor, user) : false
  const roles = assignableRoles(actor, user?.role)

  const form = useForm<FormValues>({
    resolver: zodResolver(buildSchema(mode)),
    defaultValues: emptyValues(),
  })
  const { register, handleSubmit, control, reset, setError, formState } = form
  const e = formState.errors

  useEffect(() => {
    if (!open) return
    reset(
      user
        ? {
            username: user.username,
            nameEn: user.displayName.en,
            nameKa: user.displayName.ka === user.displayName.en ? '' : user.displayName.ka,
            email: user.email,
            role: user.role,
            sipExtension: user.sipExtension ?? '',
            password: '',
            confirmPassword: '',
          }
        : emptyValues(),
    )
  }, [open, user, reset])

  const pending = create.isPending || update.isPending

  const onSubmit = handleSubmit((v) => {
    const values = {
      username: v.username.trim().toLowerCase(),
      displayName: { en: v.nameEn.trim(), ka: v.nameKa.trim() },
      email: v.email.trim(),
      role: v.role,
      sipExtension: v.sipExtension.trim(),
    }
    const onError = (error: unknown) => {
      const fields = Object.entries(fieldErrors(error))
      if (fields.length === 0) {
        toast.error(errs.toastText(error))
        return
      }
      // API field keys (`displayName.en`) map onto the form's flat names.
      for (const [key, message] of fields) {
        const name = (key === 'displayName.en' ? 'nameEn' : key === 'displayName.ka' ? 'nameKa' : key) as keyof FormValues
        setError(name, { type: 'server', message })
      }
    }
    if (user) {
      update.mutate(
        { id: user.id, values },
        {
          onSuccess: (saved) => {
            toast.success(t('form.updated', { name: l(saved.displayName) }))
            onOpenChange(false)
          },
          onError,
        },
      )
    } else {
      create.mutate(
        { ...values, password: v.password, confirmPassword: v.confirmPassword },
        {
          onSuccess: (saved) => {
            toast.success(t('form.created', { name: l(saved.displayName) }))
            onOpenChange(false)
          },
          onError,
        },
      )
    }
  })

  const err = (key: keyof FormValues) => errs.text(e[key]?.message)

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      size="lg"
      title={user ? t('form.editTitle', { name: l(user.displayName) }) : t('form.createTitle')}
      description={user ? t('form.editDescription') : t('form.createDescription')}
      footer={
        <>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={pending}>
            {tc('actions.cancel')}
          </Button>
          <Button variant="dial" type="submit" form="user-form" loading={pending}>
            {user ? t('form.submitEdit') : t('form.submitCreate')}
          </Button>
        </>
      }
    >
      <form id="user-form" onSubmit={onSubmit} noValidate className="grid gap-4 sm:grid-cols-2">
        <Field label={t('form.username')} required htmlFor="u-username" error={err('username')} hint={user ? t('form.usernameLocked') : t('form.usernameHint')}>
          <Input id="u-username" mono autoComplete="off" readOnly={Boolean(user)} disabled={Boolean(user)} invalid={Boolean(e.username)} {...register('username')} />
        </Field>
        <Field label={t('form.email')} required htmlFor="u-email" error={err('email')}>
          <Input id="u-email" type="email" autoComplete="off" invalid={Boolean(e.email)} {...register('email')} />
        </Field>
        <Field label={t('form.nameEn')} required htmlFor="u-name-en" error={err('nameEn')}>
          <Input id="u-name-en" lang="en" autoComplete="off" invalid={Boolean(e.nameEn)} {...register('nameEn')} />
        </Field>
        <Field label={t('form.nameKa')} htmlFor="u-name-ka" hint={t('form.nameKaHint')} error={err('nameKa')}>
          <Input id="u-name-ka" lang="ka" autoComplete="off" {...register('nameKa')} />
        </Field>
        <Field label={t('form.role')} required error={err('role')} hint={roleLocked ? t('form.ownRoleHint') : t('form.roleHint')}>
          <Controller
            control={control}
            name="role"
            render={({ field }) => (
              <Select
                aria-label={t('form.role')}
                value={field.value}
                onValueChange={(v) => field.onChange(v as Role)}
                disabled={roleLocked}
                invalid={Boolean(e.role)}
                options={roles.map((role) => ({ value: role, label: tc(`roles.${role}`), disabled: role === 'super_admin' }))}
              />
            )}
          />
        </Field>
        <Field label={t('form.extension')} htmlFor="u-ext" hint={t('form.extensionHint')} error={err('sipExtension')}>
          <Input id="u-ext" mono inputMode="numeric" placeholder={t('form.extensionPlaceholder')} invalid={Boolean(e.sipExtension)} {...register('sipExtension')} />
        </Field>
        {!user && (
          <>
            <Field label={t('form.password')} required htmlFor="u-pass" hint={t('form.passwordHint')} error={err('password')}>
              <Input id="u-pass" type="password" autoComplete="new-password" invalid={Boolean(e.password)} {...register('password')} />
            </Field>
            <Field label={t('form.confirmPassword')} required htmlFor="u-pass2" error={err('confirmPassword')}>
              <Input id="u-pass2" type="password" autoComplete="new-password" invalid={Boolean(e.confirmPassword)} {...register('confirmPassword')} />
            </Field>
          </>
        )}
      </form>
    </Dialog>
  )
}

function emptyValues(): FormValues {
  return { username: '', nameEn: '', nameKa: '', email: '', role: 'operator', sipExtension: '', password: '', confirmPassword: '' }
}

/* ------------------------------------------------------------ reset password */

export function ResetPasswordDialog({ user, onClose }: { user: User | null; onClose: () => void }) {
  const { t } = useTranslation('people')
  const tc = useTranslation().t
  const l = useLocalized()
  const errs = useErrorText()
  const reset = useResetPassword()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    if (user) {
      setPassword('')
      setConfirm('')
      setErrors({})
    }
  }, [user])

  const submit = (event: React.FormEvent) => {
    event.preventDefault()
    if (!user) return
    const next: Record<string, string> = {}
    if (!password) next.password = 'errors.passwordRequired'
    else if (password.length < MIN_PASSWORD) next.password = 'errors.passwordShort'
    if (password && confirm !== password) next.confirmPassword = 'errors.passwordMismatch'
    setErrors(next)
    if (Object.keys(next).length > 0) return
    reset.mutate(
      { id: user.id, password, confirmPassword: confirm },
      {
        onSuccess: () => {
          toast.success(t('reset.done', { name: l(user.displayName) }), { description: t('reset.doneHint') })
          onClose()
        },
        onError: (error) => toast.error(errs.toastText(error)),
      },
    )
  }

  return (
    <Dialog
      open={Boolean(user)}
      onOpenChange={(o) => !o && onClose()}
      size="sm"
      title={t('reset.title')}
      description={user ? t('reset.description', { name: l(user.displayName) }) : undefined}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={reset.isPending}>
            {tc('actions.cancel')}
          </Button>
          <Button variant="dial" type="submit" form="reset-form" loading={reset.isPending}>
            {t('reset.submit')}
          </Button>
        </>
      }
    >
      <form id="reset-form" onSubmit={submit} noValidate className="grid gap-4">
        <Field label={t('reset.newPassword')} required htmlFor="r-pass" hint={t('form.passwordHint')} error={errs.text(errors.password)}>
          <Input id="r-pass" type="password" autoComplete="new-password" value={password} invalid={Boolean(errors.password)} onChange={(ev) => setPassword(ev.target.value)} />
        </Field>
        <Field label={t('reset.confirm')} required htmlFor="r-pass2" error={errs.text(errors.confirmPassword)}>
          <Input id="r-pass2" type="password" autoComplete="new-password" value={confirm} invalid={Boolean(errors.confirmPassword)} onChange={(ev) => setConfirm(ev.target.value)} />
        </Field>
      </form>
    </Dialog>
  )
}

/* ------------------------------------------------------------ enable / disable */

export function ToggleActiveDialog({ user, onClose }: { user: User | null; onClose: () => void }) {
  const { t } = useTranslation('people')
  const l = useLocalized()
  const errs = useErrorText()
  const setActive = useSetActive()
  const disabling = user?.isActive ?? false
  const name = user ? l(user.displayName) : ''

  return (
    <ConfirmDialog
      open={Boolean(user)}
      onOpenChange={(o) => !o && onClose()}
      tone={disabling ? 'danger' : 'dial'}
      title={disabling ? t('toggle.disableTitle', { name }) : t('toggle.enableTitle', { name })}
      description={disabling ? t('toggle.disableBody') : t('toggle.enableBody')}
      confirmLabel={disabling ? t('actions.disable') : t('actions.enable')}
      loading={setActive.isPending}
      onConfirm={() => {
        if (!user) return
        setActive.mutate(
          { id: user.id, isActive: !user.isActive },
          {
            onSuccess: () => {
              toast.success(disabling ? t('toggle.disabled', { name }) : t('toggle.enabled', { name }))
              onClose()
            },
            onError: (error) => {
              toast.error(errs.toastText(error))
              onClose()
            },
          },
        )
      }}
    />
  )
}

/* ------------------------------------------------------------ grant super admin */

export function GrantSuperAdminDialog({ user, onClose }: { user: User | null; onClose: () => void }) {
  const { t } = useTranslation('people')
  const tc = useTranslation().t
  const l = useLocalized()
  const errs = useErrorText()
  const grant = useGrantSuperAdmin()
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    if (user) {
      setPassword('')
      setError('')
    }
  }, [user])

  const submit = (event: React.FormEvent) => {
    event.preventDefault()
    if (!user) return
    if (!password) {
      setError('errors.confirmRequired')
      return
    }
    grant.mutate(
      { id: user.id, confirmPassword: password },
      {
        onSuccess: (saved) => {
          toast.success(t('grant.done', { name: l(saved.displayName) }))
          onClose()
        },
        onError: (err) => {
          const fieldMsg = (err as { fieldErrors?: Record<string, string[]> }).fieldErrors?.confirmPassword?.[0]
          if (fieldMsg) setError(fieldMsg)
          else toast.error(errs.toastText(err))
        },
      },
    )
  }

  return (
    <Dialog
      open={Boolean(user)}
      onOpenChange={(o) => !o && onClose()}
      size="md"
      title={t('grant.title')}
      description={user ? t('grant.description', { name: l(user.displayName) }) : undefined}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={grant.isPending}>
            {tc('actions.cancel')}
          </Button>
          <Button variant="danger" type="submit" form="grant-form" loading={grant.isPending} icon={<ShieldAlert size={18} strokeWidth={1.75} />}>
            {t('grant.submit')}
          </Button>
        </>
      }
    >
      <form id="grant-form" onSubmit={submit} noValidate className="grid gap-4">
        <Alert tone="warning" title={t('grant.warningTitle')}>
          {t('grant.warning')}
        </Alert>
        <Field label={t('grant.password')} required htmlFor="g-pass" hint={t('grant.passwordHint')} error={errs.text(error)}>
          <Input
            id="g-pass"
            type="password"
            autoComplete="current-password"
            value={password}
            invalid={Boolean(error)}
            onChange={(ev) => {
              setPassword(ev.target.value)
              setError('')
            }}
          />
        </Field>
      </form>
    </Dialog>
  )
}
