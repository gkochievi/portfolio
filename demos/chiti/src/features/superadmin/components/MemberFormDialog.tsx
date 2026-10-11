import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'

import { Button, Field, Input, Modal, Select, Switch, toast } from '@/components/ui'
import { pickText } from '@/lib/format'

import { useCreateMember, useSuperErrors } from '../api'
import type { Member, MemberRole, TenantRow } from '../types'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  role: MemberRole
  tenants: TenantRow[]
  /** Preselected (and, when `lockTenant`, fixed) tenant. */
  tenantId?: string | undefined
  lockTenant?: boolean
  onCreated?: (member: Member, tenantId: string) => void
}

interface FormState {
  tenantId: string
  name: string
  nickname: string
  email: string
  username: string
  password: string
  number: string
  isExternal: boolean
}

const EMPTY: FormState = { tenantId: '', name: '', nickname: '', email: '', username: '', password: '', number: '', isExternal: false }

/** Create an admin, operator or supervisor in any tenant (adds a sign-in-able account). */
export function MemberFormDialog({ open, onOpenChange, role, tenants, tenantId, lockTenant, onCreated }: Props) {
  const { t, i18n } = useTranslation('superadmin')
  const errors = useSuperErrors()
  const create = useCreateMember()
  const [form, setForm] = useState<FormState>(EMPTY)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})

  const options = useMemo(
    () =>
      tenants
        .filter((row) => row.state !== 'deleted')
        .map((row) => ({ value: row.id, label: pickText(row.name, i18n.language), description: row.slug })),
    [tenants, i18n.language],
  )

  useEffect(() => {
    if (!open) return
    setForm({ ...EMPTY, tenantId: tenantId ?? options[0]?.value ?? '' })
    setFieldErrors({})
    create.reset()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, tenantId])

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm((current) => ({ ...current, [key]: value }))

  const validate = (): Record<string, string> => {
    const next: Record<string, string> = {}
    const msg = (code: string) => t(`errors.field.${code}`)
    if (!form.tenantId) next.tenantId = msg('tenant_required')
    if (form.name.trim().length < 2) next.name = msg('name_short')
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(form.email.trim())) next.email = msg('email_invalid')
    if (!/^[A-Za-z0-9._-]{3,32}$/.test(form.username.trim())) next.username = msg('username_invalid')
    if (form.password.length < 6) next.password = msg('password_short')
    if (form.number.trim() && !/^\d{3,4}$/.test(form.number.trim())) next.number = msg('number_invalid')
    return next
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    const found = validate()
    setFieldErrors(found)
    if (Object.keys(found).length > 0) return
    try {
      const member = await create.mutateAsync({
        tenantId: form.tenantId,
        role,
        name: form.name.trim(),
        nickname: form.nickname.trim(),
        email: form.email.trim(),
        username: form.username.trim(),
        password: form.password,
        number: form.number.trim(),
        isExternal: form.isExternal,
      })
      toast.success(t('member.created', { name: member.name.en, role: t(`roles.${role}`).toLowerCase() }))
      onCreated?.(member, form.tenantId)
      onOpenChange(false)
    } catch (failure) {
      const server = errors.fields(failure)
      if (Object.keys(server).length > 0) setFieldErrors(server)
      else toast.error(errors.text(failure))
    }
  }

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={t(`member.createTitle.${role}`)}
      description={t('member.createDescription')}
      size="md"
      footer={
        <>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            {t('common:actions.cancel')}
          </Button>
          <Button type="submit" form="create-member-form" loading={create.isPending}>
            {t('common:actions.create')}
          </Button>
        </>
      }
    >
      <form id="create-member-form" onSubmit={submit} noValidate className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Field label={t('member.tenant')} error={fieldErrors.tenantId} required>
            <Select
              value={form.tenantId}
              onValueChange={(value) => set('tenantId', value)}
              options={options}
              placeholder={t('member.tenantChoose')}
              disabled={lockTenant === true}
              invalid={!!fieldErrors.tenantId}
            />
          </Field>
        </div>
        <Field label={t('member.name')} error={fieldErrors.name} required>
          <Input value={form.name} onChange={(event) => set('name', event.target.value)} invalid={!!fieldErrors.name} autoComplete="off" />
        </Field>
        <Field label={t('member.nickname')} error={fieldErrors.nickname} hint={t('member.nicknameHint')}>
          <Input value={form.nickname} onChange={(event) => set('nickname', event.target.value)} autoComplete="off" />
        </Field>
        <Field label={t('member.email')} error={fieldErrors.email} required>
          <Input type="email" value={form.email} onChange={(event) => set('email', event.target.value)} invalid={!!fieldErrors.email} autoComplete="off" />
        </Field>
        <Field label={t('member.username')} error={fieldErrors.username} required>
          <Input value={form.username} onChange={(event) => set('username', event.target.value)} invalid={!!fieldErrors.username} autoComplete="off" mono />
        </Field>
        <Field label={t('member.password')} error={fieldErrors.password} hint={t('member.passwordHint')} required>
          <Input type="password" value={form.password} onChange={(event) => set('password', event.target.value)} invalid={!!fieldErrors.password} autoComplete="new-password" />
        </Field>
        <Field label={t('member.number')} error={fieldErrors.number} hint={t('member.numberHint')}>
          <Input value={form.number} onChange={(event) => set('number', event.target.value)} invalid={!!fieldErrors.number} inputMode="numeric" maxLength={4} mono />
        </Field>
        <div className="sm:col-span-2">
          <Switch checked={form.isExternal} onCheckedChange={(value) => set('isExternal', value)} label={t('member.external')} description={t('member.externalHint')} />
        </div>
      </form>
    </Modal>
  )
}
