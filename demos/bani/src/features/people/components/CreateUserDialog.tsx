import { zodResolver } from '@hookform/resolvers/zod'
import { useMemo, useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { z } from 'zod'

import { Button, Dialog, Field, Input, Select, SegmentedControl, Textarea, toast } from '@/components/ui'
import { fieldErrors, messageOf } from '@/api/client'
import { USER_ROLES } from '@/lib/rbac'
import type { CreateUserRequest, DirectoryEntry, UserRole } from '@/types'
import { useCreateUser } from '../api'
import { EMAIL_RE, MIN_PASSWORD, USERNAME_RE } from '../lib'
import type { SecretInfo } from './SecretDialog'
import { AccessModeField } from './AccessModeField'
import { CampaignMultiSelect } from './CampaignMultiSelect'
import { DirectoryPicker } from './DirectoryPicker'
import { PasswordField } from './PasswordField'

function useSchema() {
  const { t } = useTranslation('people')
  return useMemo(
    () =>
      z
        .object({
          role: z.string().min(1, t('validation.role')),
          userType: z.enum(['ldap', 'internal']),
          directoryUsername: z.string(),
          accessMode: z.enum(['direct', 'group']),
          username: z.string().trim(),
          displayName: z.string().trim().max(120, t('validation.tooLong')),
          email: z.string().trim(),
          password: z.string(),
          description: z.string().trim().max(280, t('validation.tooLong')),
          allowedCampaigns: z.array(z.string()),
        })
        .superRefine((v, ctx) => {
          const viaDirectory = v.role !== 'api_service' && v.userType === 'ldap'
          if (viaDirectory) {
            if (!v.directoryUsername) ctx.addIssue({ code: 'custom', path: ['directoryUsername'], message: t('validation.pickDirectory') })
            return
          }
          if (!v.username) ctx.addIssue({ code: 'custom', path: ['username'], message: t('validation.required') })
          else if (!USERNAME_RE.test(v.username)) ctx.addIssue({ code: 'custom', path: ['username'], message: t('validation.username') })
          if (v.email && !EMAIL_RE.test(v.email)) ctx.addIssue({ code: 'custom', path: ['email'], message: t('validation.email') })
          if (!v.password) ctx.addIssue({ code: 'custom', path: ['password'], message: t('validation.required') })
          else if (v.password.length < MIN_PASSWORD) ctx.addIssue({ code: 'custom', path: ['password'], message: t('validation.password') })
        }),
    [t],
  )
}

type FormValues = z.infer<ReturnType<typeof useSchema>>

export function CreateUserDialog({
  onClose,
  onSecret,
}: {
  onClose: () => void
  onSecret: (secret: SecretInfo) => void
}) {
  const { t } = useTranslation(['people', 'common'])
  const schema = useSchema()
  const create = useCreateUser()
  const [entry, setEntry] = useState<DirectoryEntry | null>(null)
  const [generated, setGenerated] = useState(false)

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      role: 'user',
      userType: 'ldap',
      directoryUsername: '',
      accessMode: 'direct',
      username: '',
      displayName: '',
      email: '',
      password: '',
      description: '',
      allowedCampaigns: [],
    },
  })
  const { control, register, handleSubmit, watch, setValue, setError, formState } = form
  const { errors } = formState
  const role = watch('role') as UserRole
  const userType = watch('userType')
  const viaDirectory = role !== 'api_service' && userType === 'ldap'

  const roleOptions = USER_ROLES.map((r) => ({ value: r, label: t(`common:roles.${r}`) }))

  const submit = handleSubmit(async (v) => {
    const request: CreateUserRequest = viaDirectory
      ? {
          userType: 'ldap',
          role: v.role as UserRole,
          username: v.directoryUsername,
          displayName: entry?.displayName,
          email: entry?.email,
          accessMode: v.accessMode,
          description: v.description,
          allowedCampaigns: role === 'cc-admin' ? v.allowedCampaigns : [],
        }
      : {
          userType: role === 'api_service' ? 'api_service' : 'internal',
          role: v.role as UserRole,
          username: v.username,
          displayName: v.displayName || undefined,
          email: v.email || undefined,
          password: v.password,
          description: v.description,
          allowedCampaigns: role === 'cc-admin' ? v.allowedCampaigns : [],
        }
    try {
      const res = await create.mutateAsync(request)
      const name = res.user.displayName || res.user.username
      toast.success(t('toast.created', { name }))
      const password = res.generatedPassword ?? (generated ? v.password : undefined)
      if (password) onSecret({ name, username: res.user.username, password, mode: 'new' })
      onClose()
    } catch (e) {
      const server = fieldErrors(e)
      const keys = Object.keys(server)
      if (keys.length === 0) toast.error(messageOf(e))
      for (const key of keys) {
        const target = key === 'username' && viaDirectory ? 'directoryUsername' : key
        if (target in v) setError(target as keyof FormValues, { type: 'server', message: server[key] })
      }
    }
  })

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !create.isPending) onClose()
      }}
      dismissible={!create.isPending}
      size="lg"
      title={t('create.title')}
      description={t('create.description')}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={create.isPending}>
            {t('common:actions.cancel')}
          </Button>
          <Button variant="primary" type="submit" form="create-user-form" loading={create.isPending}>
            {t('create.submit')}
          </Button>
        </>
      }
    >
      <form id="create-user-form" onSubmit={submit} noValidate className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t('create.role')} htmlFor="cu-role" hint={t(`roleDesc.${role}`)} error={errors.role?.message}>
            <Controller
              control={control}
              name="role"
              render={({ field }) => (
                <Select<string>
                  id="cu-role"
                  value={field.value}
                  onValueChange={(v) => {
                    field.onChange(v)
                    if (v === 'api_service') setGenerated(false)
                  }}
                  options={roleOptions}
                />
              )}
            />
          </Field>
          <Field label={t('create.userType')} hint={role === 'api_service' ? t('create.apiNote') : undefined}>
            {role === 'api_service' ? (
              <p className="flex h-9 items-center text-sm text-muted">{t('types.api_service')}</p>
            ) : (
              <Controller
                control={control}
                name="userType"
                render={({ field }) => (
                  <SegmentedControl<'ldap' | 'internal'>
                    aria-label={t('create.userType')}
                    value={field.value}
                    onChange={field.onChange}
                    options={[
                      { value: 'ldap', label: t('create.typeLdap') },
                      { value: 'internal', label: t('create.typeInternal') },
                    ]}
                  />
                )}
              />
            )}
          </Field>
        </div>

        {viaDirectory ? (
          <>
            <Field label={t('directory.pick')} required error={errors.directoryUsername?.message}>
              <DirectoryPicker
                selected={entry}
                error={errors.directoryUsername?.message}
                onSelect={(e) => {
                  setEntry(e)
                  setValue('directoryUsername', e?.username ?? '', { shouldValidate: formState.isSubmitted })
                }}
              />
            </Field>
            <Controller
              control={control}
              name="accessMode"
              render={({ field }) => <AccessModeField value={field.value} onChange={field.onChange} />}
            />
          </>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t('field.username')} htmlFor="cu-username" required error={errors.username?.message}>
              <Input id="cu-username" mono autoComplete="off" invalid={!!errors.username} {...register('username')} />
            </Field>
            <Field label={t('field.displayName')} htmlFor="cu-name" error={errors.displayName?.message}>
              <Input id="cu-name" autoComplete="off" invalid={!!errors.displayName} {...register('displayName')} />
            </Field>
            <Field label={t('field.email')} htmlFor="cu-email" error={errors.email?.message}>
              <Input id="cu-email" type="email" autoComplete="off" invalid={!!errors.email} {...register('email')} />
            </Field>
            <Field
              label={t('field.password')}
              htmlFor="cu-password"
              required
              hint={generated ? t('field.generatedHint') : t('field.passwordHint')}
              error={errors.password?.message}
            >
              <Controller
                control={control}
                name="password"
                render={({ field }) => (
                  <PasswordField
                    id="cu-password"
                    value={field.value}
                    onChange={field.onChange}
                    invalid={!!errors.password}
                    onGenerated={setGenerated}
                  />
                )}
              />
            </Field>
          </div>
        )}

        <Field label={t('field.description')} htmlFor="cu-desc" error={errors.description?.message}>
          <Textarea id="cu-desc" rows={2} placeholder={t('field.descriptionPlaceholder')} invalid={!!errors.description} {...register('description')} />
        </Field>

        {role === 'cc-admin' && (
          <Field label={t('campaigns.title')} hint={t('campaigns.hint')} error={errors.allowedCampaigns?.message}>
            <Controller
              control={control}
              name="allowedCampaigns"
              render={({ field }) => <CampaignMultiSelect value={field.value} onChange={field.onChange} />}
            />
          </Field>
        )}
      </form>
    </Dialog>
  )
}
