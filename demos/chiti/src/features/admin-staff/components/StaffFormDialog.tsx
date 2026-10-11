import { useEffect, useMemo, useState } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { UserRound } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { z } from 'zod'

import { Avatar, AvatarPicker, Button, Field, Input, Modal, Select, Switch, toast } from '@/components/ui'
import { personName } from '@/lib/format'
import type { Admin, ContentLang, Operator, Supervisor } from '@/types'

import { staffNumber, useSaveStaff, type StaffKind, type StaffRecord } from '../api'
import { useStaffErrors } from '../errors'

interface FormValues {
  nameEn: string
  nameKa: string
  nickname: string
  email: string
  username: string
  password: string
  number: string
  language: ContentLang
  isExternal: boolean
}

type Translate = (key: string) => string

function buildSchema(t: Translate, creating: boolean) {
  return z
    .object({
      nameEn: z.string().trim(),
      nameKa: z.string().trim(),
      nickname: z.string().trim().max(30, t('errors.field.nickname_long')),
      email: z.string().trim().email(t('errors.field.email_invalid')),
      username: z.string().trim().regex(/^[A-Za-z0-9._-]{3,32}$/, t('errors.field.username_invalid')),
      password: creating
        ? z.string().min(6, t('errors.field.password_short'))
        : z.string().refine((value) => value === '' || value.length >= 6, t('errors.field.password_short')),
      number: z.string().trim().regex(/^(\d{3,4})?$/, t('errors.field.number_invalid')),
      language: z.enum(['ka', 'en', 'ru']),
      isExternal: z.boolean(),
    })
    .superRefine((value, ctx) => {
      if (value.nameEn.length < 2 && value.nameKa.length < 2) {
        ctx.addIssue({ code: 'custom', path: ['nameEn'], message: t('errors.field.name_short') })
      }
    })
}

function defaultsFor(staff: StaffRecord | null, kind: StaffKind): FormValues {
  if (!staff) return { nameEn: '', nameKa: '', nickname: '', email: '', username: '', password: '', number: '', language: 'ka', isExternal: false }
  return {
    nameEn: staff.name.en,
    nameKa: staff.name.ka,
    nickname: staff.nickname,
    email: staff.email,
    username: staff.username,
    password: '',
    number: staffNumber(kind, staff),
    language: staff.language,
    isExternal: staff.isExternal,
  }
}

interface Props {
  kind: StaffKind
  open: boolean
  onOpenChange: (open: boolean) => void
  /** null = create. */
  staff: StaffRecord | null
}

/** Create/edit dialog shared by operators, admins and supervisors. */
export function StaffFormDialog({ kind, open, onOpenChange, staff }: Props) {
  const { t, i18n } = useTranslation('adminStaff')
  const tc = useTranslation().t
  const errors = useStaffErrors()
  const save = useSaveStaff(kind)
  const creating = !staff
  const isKa = i18n.language.startsWith('ka')
  const [pickerOpen, setPickerOpen] = useState(false)
  const [avatar, setAvatar] = useState<{ avatarId: string | null; avatarUrl: string | null }>({ avatarId: null, avatarUrl: null })

  const schema = useMemo(() => buildSchema((key) => t(key), creating), [t, creating])
  const form = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: defaultsFor(staff, kind) })
  const { register, handleSubmit, reset, setValue, setError, watch, formState } = form
  const language = watch('language')
  const isExternal = watch('isExternal')
  const nameEn = watch('nameEn')
  const nameKa = watch('nameKa')

  useEffect(() => {
    if (!open) return
    reset(defaultsFor(staff, kind))
    const operator = staff && kind === 'operator' ? (staff as Operator) : null
    setAvatar({ avatarId: operator?.avatarId ?? null, avatarUrl: operator?.avatarUrl ?? null })
    save.reset()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, staff?.id])

  const kindKey = kind === 'operator' ? 'operators' : kind === 'admin' ? 'admins' : 'supervisors'
  const fieldErr = (name: keyof FormValues) => formState.errors[name]?.message

  const onSubmit = handleSubmit(async (values) => {
    try {
      const saved = await save.mutateAsync({
        id: staff?.id,
        input: {
          name: { en: values.nameEn, ka: values.nameKa },
          nickname: values.nickname,
          email: values.email,
          username: values.username,
          password: values.password,
          number: values.number,
          language: values.language,
          isExternal: values.isExternal,
          ...(kind === 'operator' ? { avatarId: avatar.avatarId, avatarUrl: avatar.avatarUrl } : {}),
        },
      })
      const name = personName((saved as Operator | Admin | Supervisor).name, i18n.language)
      toast.success(t(creating ? `${kindKey}.toast.created` : `${kindKey}.toast.updated`, { name }))
      onOpenChange(false)
    } catch (error) {
      const fields = errors.fields(error)
      if (fields.length > 0) for (const [field, message] of fields) setError(field as keyof FormValues, { type: 'server', message })
      else toast.error(errors.text(error))
    }
  })

  const english = { key: 'nameEn' as const, label: t('form.nameEn'), lang: 'en' }
  const georgian = { key: 'nameKa' as const, label: t('form.nameKa'), lang: 'ka' }
  const nameFields = isKa ? [georgian, english] : [english, georgian]

  const previewName = (isKa ? nameKa || nameEn : nameEn || nameKa) || t('form.nickname')

  return (
    <>
      <Modal
        open={open}
        onOpenChange={onOpenChange}
        size="lg"
        dismissible={!save.isPending}
        title={t(creating ? `${kindKey}.dialog.createTitle` : `${kindKey}.dialog.editTitle`)}
        description={creating ? t(`${kindKey}.dialog.createDescription`) : undefined}
        footer={
          <>
            <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={save.isPending}>
              {tc('actions.cancel')}
            </Button>
            <Button type="submit" form="staff-form" loading={save.isPending}>
              {creating ? t('form.create') : t('form.save')}
            </Button>
          </>
        }
      >
        <form id="staff-form" onSubmit={onSubmit} noValidate className="grid gap-4 sm:grid-cols-2">
          {kind === 'operator' ? (
            <div className="flex items-center gap-3 sm:col-span-2">
              <Avatar name={previewName} avatarId={avatar.avatarId} avatarUrl={avatar.avatarUrl} size="lg" />
              <div>
                <p className="text-sm font-medium">{t('form.avatar')}</p>
                <Button type="button" variant="outline" size="sm" leftIcon={<UserRound size={16} strokeWidth={1.75} />} onClick={() => setPickerOpen(true)}>
                  {t('form.chooseAvatar')}
                </Button>
              </div>
            </div>
          ) : null}

          {nameFields.map((field, index) => (
            <Field
              key={field.key}
              label={field.label}
              htmlFor={`staff-${field.key}`}
              error={fieldErr(field.key)}
              required={index === 0}
            >
              <Input id={`staff-${field.key}`} autoComplete="off" invalid={!!fieldErr(field.key)} lang={field.lang} {...register(field.key)} />
            </Field>
          ))}
          <p className="-mt-2 text-[12px] text-muted sm:col-span-2">{t('form.nameHint')}</p>

          <Field label={t('form.nickname')} htmlFor="staff-nickname" hint={t('form.nicknameHint')} error={fieldErr('nickname')}>
            <Input id="staff-nickname" autoComplete="off" invalid={!!fieldErr('nickname')} {...register('nickname')} />
          </Field>
          <Field label={t('form.number')} htmlFor="staff-number" hint={t('form.numberHint')} error={fieldErr('number')}>
            <Input id="staff-number" inputMode="numeric" mono maxLength={4} autoComplete="off" invalid={!!fieldErr('number')} {...register('number')} />
          </Field>

          <Field label={t('form.email')} htmlFor="staff-email" required error={fieldErr('email')}>
            <Input id="staff-email" type="email" autoComplete="off" invalid={!!fieldErr('email')} {...register('email')} />
          </Field>
          <Field label={t('form.username')} htmlFor="staff-username" required error={fieldErr('username')}>
            <Input id="staff-username" autoComplete="off" autoCapitalize="none" invalid={!!fieldErr('username')} {...register('username')} />
          </Field>

          <Field
            label={creating ? t('form.password') : t('form.passwordNew')}
            htmlFor="staff-password"
            required={creating}
            hint={creating ? t('form.passwordHintCreate') : t('form.passwordHintEdit')}
            error={fieldErr('password')}
          >
            <Input id="staff-password" type="password" autoComplete="new-password" invalid={!!fieldErr('password')} {...register('password')} />
          </Field>
          <Field label={t('form.language')} htmlFor="staff-language" error={fieldErr('language')}>
            <Select
              id="staff-language"
              value={language}
              onValueChange={(value) => setValue('language', value as ContentLang, { shouldDirty: true })}
              options={(['ka', 'en', 'ru'] as const).map((value) => ({ value, label: tc(`lang.${value}`) }))}
            />
          </Field>

          <div className="sm:col-span-2">
            <Switch
              checked={isExternal}
              onCheckedChange={(checked) => setValue('isExternal', checked, { shouldDirty: true })}
              label={t('form.external')}
              description={t('form.externalHint')}
            />
          </div>
        </form>
      </Modal>
      {kind === 'operator' ? (
        <AvatarPicker open={pickerOpen} onOpenChange={setPickerOpen} name={previewName} value={avatar} onChange={setAvatar} />
      ) : null}
    </>
  )
}
