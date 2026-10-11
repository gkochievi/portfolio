/** "New account" form in the shared SideSheet: first, last, role, email, username (password is a demo no-op). */
import { zodResolver } from '@hookform/resolvers/zod'
import { Info, UserPlus } from 'lucide-react'
import { useEffect } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { z } from 'zod'

import { Button, Field, Input, Select, SideSheet, toast, toastError } from '@/components/ui'
import { ApiError } from '@/lib/api'
import type { Role } from '@/types'
import { useCreateUser } from '../api'

export const ROLES: readonly Role[] = ['SUPERADMIN', 'ADMIN', 'SUPERVISOR', 'PLAYER']

const schema = z.object({
  firstName: z.string().trim().min(1, 'common:errors.required').max(60),
  lastName: z.string().trim().min(1, 'common:errors.required').max(60),
  role: z.enum(['SUPERADMIN', 'ADMIN', 'SUPERVISOR', 'PLAYER']),
  email: z.string().trim().min(1, 'common:errors.required').email('common:errors.invalidEmail'),
  username: z
    .string()
    .trim()
    .refine((value) => value === '' || /^[a-z0-9._-]{3,32}$/.test(value), 'people:errors.usernameInvalid'),
  password: z.string().refine((value) => value === '' || value.length >= 6, 'people:errors.passwordShort'),
})

type FormValues = z.infer<typeof schema>

const EMPTY: FormValues = { firstName: '', lastName: '', role: 'PLAYER', email: '', username: '', password: '' }
const FORM_ID = 'people-create-user'

export function CreateUserSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { t } = useTranslation('people')
  const create = useCreateUser()
  const {
    register,
    control,
    handleSubmit,
    reset,
    setError,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: EMPTY })

  useEffect(() => {
    if (open) {
      reset(EMPTY)
      create.reset()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const onSubmit = handleSubmit(async (values) => {
    try {
      // The password is deliberately not sent: the demo never stores one.
      const user = await create.mutateAsync({
        firstName: values.firstName.trim(),
        lastName: values.lastName.trim(),
        role: values.role,
        email: values.email.trim(),
        username: values.username.trim() || undefined,
      })
      toast.success(t('people.toasts.created', { name: `${user.firstName} ${user.lastName}` }))
      onOpenChange(false)
    } catch (error) {
      if (error instanceof ApiError && Object.keys(error.fieldErrors ?? {}).length) {
        for (const [field, messages] of Object.entries(error.fieldErrors)) {
          if (field in EMPTY) setError(field as keyof FormValues, { message: messages[0] })
        }
        return
      }
      toastError(error)
    }
  })

  return (
    <SideSheet
      open={open}
      onOpenChange={onOpenChange}
      title={t('form.title')}
      description={t('form.description')}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            {t('common:actions.cancel')}
          </Button>
          <Button type="submit" form={FORM_ID} loading={create.isPending} leftIcon={<UserPlus className="size-4" />}>
            {t('form.submit')}
          </Button>
        </div>
      }
    >
      <form id={FORM_ID} noValidate onSubmit={onSubmit} className="flex flex-col gap-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t('fields.firstName')} required error={errors.firstName?.message}>
            {(id) => <Input id={id} autoComplete="off" invalid={Boolean(errors.firstName)} {...register('firstName')} />}
          </Field>
          <Field label={t('fields.lastName')} required error={errors.lastName?.message}>
            {(id) => <Input id={id} autoComplete="off" invalid={Boolean(errors.lastName)} {...register('lastName')} />}
          </Field>
        </div>

        <Field label={t('fields.role')} required error={errors.role?.message}>
          {(id) => (
            <Controller
              control={control}
              name="role"
              render={({ field }) => (
                <Select
                  id={id}
                  value={field.value}
                  onValueChange={(value) => field.onChange(value as Role)}
                  options={ROLES.map((role) => ({
                    value: role,
                    label: t(`common:roles.${role}`),
                    hint: t(`form.roleHints.${role}`),
                  }))}
                />
              )}
            />
          )}
        </Field>

        <Field label={t('fields.email')} required error={errors.email?.message}>
          {(id) => (
            <Input id={id} type="email" inputMode="email" autoComplete="off" invalid={Boolean(errors.email)} {...register('email')} />
          )}
        </Field>

        <Field label={t('fields.username')} hint={t('form.usernameHint')} error={errors.username?.message}>
          {(id) => (
            <Input
              id={id}
              autoComplete="off"
              autoCapitalize="none"
              spellCheck={false}
              invalid={Boolean(errors.username)}
              {...register('username', { setValueAs: (value: string) => value.toLowerCase() })}
            />
          )}
        </Field>

        <Field label={t('fields.password')} hint={t('form.passwordHint')} error={errors.password?.message}>
          {(id) => (
            <Input id={id} type="password" autoComplete="new-password" invalid={Boolean(errors.password)} {...register('password')} />
          )}
        </Field>

        <p className="flex items-start gap-2 rounded-card bg-info-soft px-3 py-2.5 text-sm text-ink">
          <Info className="mt-0.5 size-4 shrink-0 text-info" aria-hidden />
          <span>{t('form.demoNote')}</span>
        </p>
      </form>
    </SideSheet>
  )
}
