import { useMemo } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm, useWatch } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { z } from 'zod'

import { Banner, Button, Card, CardBody, CardFooter, CardHeader, Checkbox, Field, Input, NativeSelect, toast } from '@/components/ui'
import type { StaffRole, StaffUser, TechnicianType } from '@/types'

import { apiErrorMessage, applyFieldErrors, type StaffUserFormValues } from '../api'

const ROLES: StaffRole[] = ['superadmin', 'accountant', 'l1_employee', 'technician']
const TYPES: TechnicianType[] = ['webdeveloper', 'voip_engineer', 'both']
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

interface FormValues {
  email: string
  fullName: string
  fullNameKa: string
  role: StaffRole
  technicianType: string
  password: string
  isActive: boolean
}

interface Props {
  user?: StaffUser
  /** Editing your own account: role and active are locked. */
  isSelf?: boolean
  title: string
  description?: string
  submitLabel: string
  onSubmit: (values: StaffUserFormValues) => Promise<void>
  onCancel: () => void
}

export function StaffUserForm({ user, isSelf, title, description, submitLabel, onSubmit, onCancel }: Props) {
  const { t } = useTranslation(['admin-catalog', 'common'])
  const editing = Boolean(user)

  const schema = useMemo(
    () =>
      z
        .object({
          email: z.string().trim().min(1, t('validation.required')).regex(EMAIL_RE, t('validation.emailInvalid')),
          fullName: z.string().trim().min(1, t('validation.required')).max(200, t('validation.tooLong')),
          fullNameKa: z.string().trim().max(200, t('validation.tooLong')),
          role: z.enum(['superadmin', 'accountant', 'l1_employee', 'technician']),
          technicianType: z.string(),
          password: z.string(),
          isActive: z.boolean(),
        })
        .superRefine((v, ctx) => {
          if (v.role === 'technician' && !TYPES.includes(v.technicianType as TechnicianType)) {
            ctx.addIssue({ code: 'custom', path: ['technicianType'], message: t('validation.required') })
          }
          if (!editing && v.password.length < 8) ctx.addIssue({ code: 'custom', path: ['password'], message: t('validation.passwordMin') })
          if (editing && v.password.length > 0 && v.password.length < 8) {
            ctx.addIssue({ code: 'custom', path: ['password'], message: t('validation.passwordMin') })
          }
        }),
    [t, editing],
  )

  const {
    register,
    handleSubmit,
    control,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      email: user?.email ?? '',
      fullName: user?.fullName ?? '',
      fullNameKa: user?.fullNameKa ?? '',
      role: user?.role ?? 'l1_employee',
      technicianType: user?.technicianType ?? '',
      password: '',
      isActive: user?.isActive ?? true,
    },
  })
  const role = useWatch({ control, name: 'role' })
  // Not `disabled`: react-hook-form drops disabled fields from the submitted values.
  const lock = isSelf ? { 'aria-disabled': true, tabIndex: -1, className: 'pointer-events-none opacity-60' } : {}

  const submit = handleSubmit(async (v) => {
    const payload: StaffUserFormValues = {
      email: v.email.trim(),
      fullName: v.fullName.trim(),
      fullNameKa: v.fullNameKa.trim(),
      role: v.role,
      technicianType: v.role === 'technician' ? (v.technicianType as TechnicianType) : null,
      isActive: v.isActive,
    }
    if (v.password) payload.password = v.password
    try {
      await onSubmit(payload)
    } catch (e) {
      if (!applyFieldErrors(t, e, setError)) toast.error(apiErrorMessage(t, e))
    }
  })

  return (
    <form onSubmit={submit} noValidate>
      <Card>
        <CardHeader title={title} description={description} />
        <CardBody className="grid gap-4">
          {isSelf ? <Banner tone="info">{t('userForm.selfNote')}</Banner> : null}

          <Field label={t('userForm.email')} required error={errors.email?.message} htmlFor="u-email">
            <Input id="u-email" type="email" autoComplete="off" invalid={Boolean(errors.email)} {...register('email')} />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t('userForm.fullName')} required error={errors.fullName?.message} htmlFor="u-name">
              <Input id="u-name" autoComplete="off" invalid={Boolean(errors.fullName)} {...register('fullName')} />
            </Field>
            <Field label={t('userForm.fullNameKa')} hint={t('userForm.fullNameKaHint')} error={errors.fullNameKa?.message} htmlFor="u-name-ka">
              <Input id="u-name-ka" lang="ka" autoComplete="off" invalid={Boolean(errors.fullNameKa)} {...register('fullNameKa')} />
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t('userForm.role')} required error={errors.role?.message} htmlFor="u-role">
              <NativeSelect
                id="u-role"
                {...lock}
                options={ROLES.map((r) => ({ value: r, label: t(`common:role.${r}`) }))}
                {...register('role')}
              />
            </Field>
            {role === 'technician' ? (
              <Field label={t('userForm.technicianType')} hint={t('userForm.technicianTypeHint')} required error={errors.technicianType?.message} htmlFor="u-type">
                <NativeSelect
                  id="u-type"
                  placeholder={t('userForm.chooseType')}
                  invalid={Boolean(errors.technicianType)}
                  options={TYPES.map((x) => ({ value: x, label: t(`common:technicianType.${x}`) }))}
                  {...register('technicianType')}
                />
              </Field>
            ) : null}
          </div>

          <Field
            label={t('userForm.password')}
            required={!editing}
            hint={editing ? t('userForm.passwordHintEdit') : t('userForm.passwordHintCreate')}
            error={errors.password?.message}
            htmlFor="u-pass"
          >
            <Input id="u-pass" type="password" autoComplete="new-password" invalid={Boolean(errors.password)} {...register('password')} />
          </Field>

          <Checkbox label={t('userForm.active')} description={t('userForm.activeDescription')} {...lock} {...register('isActive')} />
        </CardBody>
        <CardFooter>
          <Button variant="ghost" onClick={onCancel} disabled={isSubmitting}>
            {t('common:actions.cancel')}
          </Button>
          <Button type="submit" loading={isSubmitting}>
            {submitLabel}
          </Button>
        </CardFooter>
      </Card>
    </form>
  )
}
