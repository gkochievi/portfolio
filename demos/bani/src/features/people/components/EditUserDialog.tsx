import { zodResolver } from '@hookform/resolvers/zod'
import { RefreshCw } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { z } from 'zod'

import {
  Avatar,
  Badge,
  Button,
  ConfirmDialog,
  Dialog,
  Field,
  Input,
  SegmentedControl,
  Select,
  Switch,
  Textarea,
  toast,
} from '@/components/ui'
import { fieldErrors, messageOf } from '@/api/client'
import { fmtDateTime, timeAgo } from '@/lib/format'
import { USER_ROLES } from '@/lib/rbac'
import { useLang } from '@/shell/state'
import type { ConsoleUser, UpdateUserRequest, UserRole } from '@/types'
import { useRegeneratePassword, useUpdateUser } from '../api'
import { EMAIL_RE, MIN_PASSWORD, userLabel } from '../lib'
import { AccessModeField } from './AccessModeField'
import { CampaignMultiSelect } from './CampaignMultiSelect'
import { PasswordField } from './PasswordField'
import type { SecretInfo } from './SecretDialog'

function useSchema() {
  const { t } = useTranslation('people')
  return useMemo(
    () =>
      z
        .object({
          role: z.string().min(1, t('validation.role')),
          displayName: z.string().trim().max(120, t('validation.tooLong')),
          email: z.string().trim(),
          password: z.string(),
          description: z.string().trim().max(280, t('validation.tooLong')),
          isActive: z.boolean(),
          accessMode: z.enum(['direct', 'group']),
          downloadFormat: z.enum(['mp3', 'original']),
          allowedCampaigns: z.array(z.string()),
        })
        .superRefine((v, ctx) => {
          if (v.email && !EMAIL_RE.test(v.email)) ctx.addIssue({ code: 'custom', path: ['email'], message: t('validation.email') })
          if (v.password && v.password.length < MIN_PASSWORD) {
            ctx.addIssue({ code: 'custom', path: ['password'], message: t('validation.password') })
          }
        }),
    [t],
  )
}

type FormValues = z.infer<ReturnType<typeof useSchema>>

export function EditUserDialog({
  user,
  isSelf,
  onClose,
  onSecret,
}: {
  user: ConsoleUser
  /** The signed-in superadmin editing their own account (role and active state are locked). */
  isSelf: boolean
  onClose: () => void
  onSecret: (secret: SecretInfo) => void
}) {
  const { t } = useTranslation(['people', 'common'])
  const lang = useLang()
  const schema = useSchema()
  const update = useUpdateUser()
  const regenerate = useRegeneratePassword()
  const [generated, setGenerated] = useState(false)
  const [confirmRegen, setConfirmRegen] = useState(false)

  const isApi = user.userType === 'api_service'
  const isDirectory = user.userType === 'ldap'
  const name = userLabel(user)

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      role: user.role,
      displayName: user.displayName ?? '',
      email: user.email ?? '',
      password: '',
      description: user.description,
      isActive: user.isActive,
      accessMode: user.accessMode,
      downloadFormat: user.downloadFormat,
      allowedCampaigns: user.allowedCampaigns,
    },
  })
  const { control, register, handleSubmit, watch, setError, formState } = form
  const { errors } = formState
  const role = watch('role') as UserRole

  const roleOptions = USER_ROLES.filter((r) => isApi || r !== 'api_service').map((r) => ({
    value: r,
    label: t(`common:roles.${r}`),
  }))
  const roleLocked = isApi || isSelf

  const busy = update.isPending || regenerate.isPending

  const submit = handleSubmit(async (v) => {
    const request: UpdateUserRequest = {
      role: v.role as UserRole,
      description: v.description,
      isActive: v.isActive,
      allowedCampaigns: v.role === 'cc-admin' ? v.allowedCampaigns : [],
      ...(isDirectory ? { accessMode: v.accessMode } : { displayName: v.displayName, email: v.email }),
      ...(isApi ? { downloadFormat: v.downloadFormat } : {}),
      ...(!isDirectory && v.password ? { password: v.password } : {}),
    }
    try {
      await update.mutateAsync({ id: user.id, update: request })
      toast.success(t('toast.updated', { name }))
      if (generated && v.password) onSecret({ name, username: user.username, password: v.password, mode: 'regenerated' })
      onClose()
    } catch (e) {
      const server = fieldErrors(e)
      const keys = Object.keys(server)
      if (keys.length === 0) toast.error(messageOf(e))
      for (const key of keys) {
        if (key in v) setError(key as keyof FormValues, { type: 'server', message: server[key] })
      }
    }
  })

  const doRegenerate = async () => {
    try {
      const res = await regenerate.mutateAsync(user.id)
      toast.success(t('toast.passwordRegenerated', { name }))
      setConfirmRegen(false)
      onSecret({ name, username: user.username, password: res.password, mode: 'regenerated' })
      onClose()
    } catch (e) {
      setConfirmRegen(false)
      toast.error(messageOf(e))
    }
  }

  return (
    <>
      <Dialog
        open
        onOpenChange={(open) => {
          if (!open && !busy) onClose()
        }}
        dismissible={!busy}
        size="lg"
        title={t('edit.title')}
        description={name}
        footer={
          <>
            <Button variant="ghost" onClick={onClose} disabled={busy}>
              {t('common:actions.cancel')}
            </Button>
            <Button variant="primary" type="submit" form="edit-user-form" loading={update.isPending}>
              {t('edit.save')}
            </Button>
          </>
        }
      >
        <form id="edit-user-form" onSubmit={submit} noValidate className="space-y-5">
          <div className="flex items-start gap-3 rounded-[10px] border border-line bg-sunken p-3">
            <Avatar name={name} size={40} />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="break-all font-mono text-sm text-ink">{user.username}</span>
                <Badge tone={isApi ? 'bronze' : isDirectory ? 'info' : 'neutral'}>{t(`types.${user.userType}`)}</Badge>
              </div>
              <p className="mt-0.5 text-xs text-muted">
                {t('edit.created')} {fmtDateTime(user.createdAt, lang)} · {t('edit.lastLogin')}{' '}
                {user.lastLoginAt ? timeAgo(user.lastLoginAt, lang) : t('common:states.never')}
              </p>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label={t('create.role')}
              htmlFor="eu-role"
              hint={isApi ? t('edit.roleLocked') : isSelf ? t('edit.roleSelf') : t(`roleDesc.${role}`)}
              error={errors.role?.message}
            >
              <Controller
                control={control}
                name="role"
                render={({ field }) => (
                  <Select<string> id="eu-role" value={field.value} onValueChange={field.onChange} options={roleOptions} disabled={roleLocked} />
                )}
              />
            </Field>
            <Field label={t('edit.active')} hint={isSelf ? t('edit.activeSelf') : t('edit.activeHint')} error={errors.isActive?.message}>
              <Controller
                control={control}
                name="isActive"
                render={({ field }) => (
                  <Switch
                    checked={field.value}
                    onCheckedChange={field.onChange}
                    disabled={isSelf}
                    label={field.value ? t('status.active') : t('status.disabled')}
                    aria-label={t('edit.active')}
                  />
                )}
              />
            </Field>
          </div>

          {!isDirectory && (
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={t('field.displayName')} htmlFor="eu-name" error={errors.displayName?.message}>
                <Input id="eu-name" invalid={!!errors.displayName} {...register('displayName')} />
              </Field>
              <Field label={t('field.email')} htmlFor="eu-email" error={errors.email?.message}>
                <Input id="eu-email" type="email" invalid={!!errors.email} {...register('email')} />
              </Field>
            </div>
          )}

          {isDirectory && (
            <Controller
              control={control}
              name="accessMode"
              render={({ field }) => <AccessModeField value={field.value} onChange={field.onChange} />}
            />
          )}

          <Field label={t('field.description')} htmlFor="eu-desc" error={errors.description?.message}>
            <Textarea id="eu-desc" rows={2} placeholder={t('field.descriptionPlaceholder')} invalid={!!errors.description} {...register('description')} />
          </Field>

          {isApi && (
            <Field label={t('edit.downloadFormat')} hint={t('edit.downloadHint')}>
              <Controller
                control={control}
                name="downloadFormat"
                render={({ field }) => (
                  <SegmentedControl<'mp3' | 'original'>
                    aria-label={t('edit.downloadFormat')}
                    value={field.value}
                    onChange={field.onChange}
                    options={[
                      { value: 'mp3', label: t('edit.formatMp3') },
                      { value: 'original', label: t('edit.formatOriginal') },
                    ]}
                  />
                )}
              />
            </Field>
          )}

          {role === 'cc-admin' && (
            <Field label={t('campaigns.title')} hint={t('campaigns.hint')} error={errors.allowedCampaigns?.message}>
              <Controller
                control={control}
                name="allowedCampaigns"
                render={({ field }) => <CampaignMultiSelect value={field.value} onChange={field.onChange} />}
              />
            </Field>
          )}

          {isDirectory ? (
            <p className="text-sm text-muted">{t('edit.directoryPassword')}</p>
          ) : (
            <div className="space-y-3 rounded-[10px] border border-line p-3">
              <Field
                label={t('edit.newPassword')}
                htmlFor="eu-password"
                hint={generated ? t('field.generatedHint') : t('edit.newPasswordHint')}
                error={errors.password?.message}
              >
                <Controller
                  control={control}
                  name="password"
                  render={({ field }) => (
                    <PasswordField
                      id="eu-password"
                      value={field.value}
                      onChange={field.onChange}
                      invalid={!!errors.password}
                      onGenerated={setGenerated}
                    />
                  )}
                />
              </Field>
              <Button icon={RefreshCw} onClick={() => setConfirmRegen(true)} disabled={busy}>
                {t('edit.regenerate')}
              </Button>
            </div>
          )}
        </form>
      </Dialog>

      <ConfirmDialog
        open={confirmRegen}
        onOpenChange={(open) => {
          if (!regenerate.isPending) setConfirmRegen(open)
        }}
        title={t('edit.regenerateTitle')}
        body={t('edit.regenerateBody', { name })}
        confirmLabel={t('edit.regenerate')}
        busy={regenerate.isPending}
        onConfirm={() => void doRegenerate()}
      />
    </>
  )
}
