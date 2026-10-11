import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { LogIn, Pencil, Plus, Trash2 } from 'lucide-react'

import { Avatar, Badge, Button, ConfirmDialog, EmptyState, Field, IconButton, Input, Switch, Tooltip, toast } from '@/components/ui'
import { personName } from '@/lib/format'

import { useDeleteMember, useSuperErrors, useUpdateMember } from '../api'
import type { Member, MemberRole, TenantRow } from '../types'
import { useLogInAs } from '../useLogInAs'

const NUMBER_KEY = { operator: 'operatorNumber', admin: 'adminNumber', supervisor: 'supervisorNumber' } as const

export function memberNumber(role: MemberRole, member: Member): string {
  return (member as unknown as Record<string, string>)[NUMBER_KEY[role]] ?? ''
}

interface Props {
  tenant: TenantRow
  role: MemberRole
  members: Member[]
  onAdd: () => void
}

export function MembersTab({ tenant, role, members, onAdd }: Props) {
  const { t, i18n } = useTranslation('superadmin')
  const errors = useSuperErrors()
  const remove = useDeleteMember()
  const { logInAs, busy } = useLogInAs()
  const [editing, setEditing] = useState<string | null>(null)
  const [removing, setRemoving] = useState<Member | null>(null)
  const canLogIn = tenant.state === 'active'

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[13px] text-muted">{t('members.count', { count: members.length })}</p>
        <Button size="sm" variant="secondary" leftIcon={<Plus />} onClick={onAdd} disabled={tenant.state === 'deleted'}>
          {t(`member.add.${role}`)}
        </Button>
      </div>

      {members.length === 0 ? (
        <EmptyState compact title={t(`members.empty.${role}`)} description={t('members.emptyHint')} />
      ) : (
        <ul className="divide-y divide-line overflow-hidden rounded-modal border border-line bg-panel">
          {members.map((member) => (
            <li key={member.id} className="p-3 sm:px-4">
              {editing === member.id ? (
                <InlineEdit role={role} member={member} onDone={() => setEditing(null)} />
              ) : (
                <div className="flex flex-wrap items-center gap-3">
                  <Avatar name={personName(member.name, i18n.language)} size="md" />
                  <div className="min-w-0 flex-1 basis-48">
                    <p className="flex flex-wrap items-center gap-2 font-medium text-ink">
                      <span className="truncate">{personName(member.name, i18n.language)}</span>
                      <span className="tabular text-[12px] font-normal text-muted">#{memberNumber(role, member)}</span>
                      {member.isExternal && <Badge tone="outline" size="sm">{t('member.externalBadge')}</Badge>}
                    </p>
                    <p className="truncate text-[13px] text-muted">
                      {member.nickname} · <span className="font-mono text-[12px]">{member.username}</span> · {member.email}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Tooltip content={canLogIn ? t('members.logInAsHint') : t(`members.logInBlocked.${tenant.state}`)} disabled={false}>
                      <span>
                        <Button size="xs" variant="outline" leftIcon={<LogIn />} disabled={!canLogIn || busy} onClick={() => void logInAs(role, member.id)}>
                          {t('members.logInAs')}
                        </Button>
                      </span>
                    </Tooltip>
                    <IconButton size="sm" variant="ghost" label={t('common:actions.edit')} icon={<Pencil strokeWidth={1.75} />} onClick={() => setEditing(member.id)} />
                    <IconButton size="sm" variant="ghost" label={t('common:actions.delete')} icon={<Trash2 strokeWidth={1.75} />} onClick={() => setRemoving(member)} />
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      <ConfirmDialog
        open={removing !== null}
        onOpenChange={(open) => !open && setRemoving(null)}
        title={t('members.deleteTitle', { name: removing ? personName(removing.name, i18n.language) : '' })}
        description={t(`members.deleteDescription.${role}`)}
        confirmLabel={t('common:actions.delete')}
        tone="danger"
        onConfirm={async () => {
          if (!removing) return
          try {
            await remove.mutateAsync({ role, id: removing.id })
            toast.success(t('members.deleted'))
          } catch (failure) {
            toast.error(errors.text(failure))
            throw failure
          }
        }}
      />
    </div>
  )
}

function InlineEdit({ role, member, onDone }: { role: MemberRole; member: Member; onDone: () => void }) {
  const { t, i18n } = useTranslation('superadmin')
  const errors = useSuperErrors()
  const update = useUpdateMember()
  const [form, setForm] = useState({
    name: member.name.en,
    nameKa: member.name.ka,
    nickname: member.nickname,
    email: member.email,
    username: member.username,
    number: memberNumber(role, member),
    password: '',
    isExternal: member.isExternal,
  })
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) => setForm((current) => ({ ...current, [key]: value }))

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    const local: Record<string, string> = {}
    if (form.name.trim().length < 2 && form.nameKa.trim().length < 2) local.name = t('errors.field.name_short')
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(form.email.trim())) local.email = t('errors.field.email_invalid')
    if (!/^[A-Za-z0-9._-]{3,32}$/.test(form.username.trim())) local.username = t('errors.field.username_invalid')
    if (form.password && form.password.length < 6) local.password = t('errors.field.password_short')
    if (!/^\d{3,4}$/.test(form.number.trim())) local.number = t('errors.field.number_invalid')
    setFieldErrors(local)
    if (Object.keys(local).length > 0) return
    try {
      await update.mutateAsync({
        role,
        id: member.id,
        name: { en: form.name.trim(), ka: form.nameKa.trim() },
        nickname: form.nickname.trim(),
        email: form.email.trim(),
        username: form.username.trim(),
        number: form.number.trim(),
        password: form.password,
        isExternal: form.isExternal,
      })
      toast.success(t('members.saved'))
      onDone()
    } catch (failure) {
      const server = errors.fields(failure)
      if (Object.keys(server).length > 0) setFieldErrors(server)
      else toast.error(errors.text(failure))
    }
  }

  return (
    <form onSubmit={submit} noValidate className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" aria-label={t('members.editing', { name: personName(member.name, i18n.language) })}>
      <Field label={t('member.nameEn')} error={fieldErrors.name}>
        <Input size="sm" value={form.name} onChange={(event) => set('name', event.target.value)} invalid={!!fieldErrors.name} />
      </Field>
      <Field label={t('member.nameKa')}>
        <Input size="sm" value={form.nameKa} onChange={(event) => set('nameKa', event.target.value)} lang="ka" />
      </Field>
      <Field label={t('member.nickname')} error={fieldErrors.nickname}>
        <Input size="sm" value={form.nickname} onChange={(event) => set('nickname', event.target.value)} />
      </Field>
      <Field label={t('member.email')} error={fieldErrors.email}>
        <Input size="sm" type="email" value={form.email} onChange={(event) => set('email', event.target.value)} invalid={!!fieldErrors.email} />
      </Field>
      <Field label={t('member.username')} error={fieldErrors.username}>
        <Input size="sm" mono value={form.username} onChange={(event) => set('username', event.target.value)} invalid={!!fieldErrors.username} />
      </Field>
      <Field label={t('member.number')} error={fieldErrors.number}>
        <Input size="sm" mono inputMode="numeric" maxLength={4} value={form.number} onChange={(event) => set('number', event.target.value)} invalid={!!fieldErrors.number} />
      </Field>
      <Field label={t('members.newPassword')} hint={t('members.newPasswordHint')} error={fieldErrors.password}>
        <Input size="sm" type="password" autoComplete="new-password" value={form.password} onChange={(event) => set('password', event.target.value)} invalid={!!fieldErrors.password} />
      </Field>
      <div className="flex items-end pb-1.5">
        <Switch size="sm" checked={form.isExternal} onCheckedChange={(value) => set('isExternal', value)} label={t('member.external')} />
      </div>
      <div className="flex items-end justify-end gap-2 sm:col-span-2 lg:col-span-1">
        <Button type="button" size="sm" variant="ghost" onClick={onDone}>
          {t('common:actions.cancel')}
        </Button>
        <Button type="submit" size="sm" loading={update.isPending}>
          {t('common:actions.save')}
        </Button>
      </div>
    </form>
  )
}
