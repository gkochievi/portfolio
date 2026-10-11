/** Create / edit a chat-service credential: name, scopes and per-workspace grants. */
import { useEffect, useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { errorMessage, fieldError } from '@/api/client'
import { Button, Checkbox, Dialog, Field, FilterChip, IconButton, Input, Select, Switch, toast } from '@/components/ui'
import type { ChatScope, Id, Integration } from '@/types'
import { useCreateIntegration, usePatchIntegration } from '../api'
import { CHAT_SCOPES, type AssignmentRow, type IntegrationGrantInput, type IntegrationSecretOnce } from '../types'

export const scopeKey = (s: ChatScope): string => s.replace(':', '_')

export const workspaceName = (w: Pick<AssignmentRow, 'name' | 'name_ka'> | undefined, lang: string, fallback = ''): string =>
  w ? (lang.startsWith('ka') ? w.name_ka : w.name) : fallback

export function IntegrationDialog({
  open,
  onOpenChange,
  integration,
  workspaces,
  onCreated,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  integration: Integration | null
  workspaces: AssignmentRow[]
  onCreated: (secret: IntegrationSecretOnce, name: string) => void
}) {
  const { t, i18n } = useTranslation('consoleAi')
  const lang = i18n.language
  const create = useCreateIntegration()
  const patch = usePatchIntegration()
  const pending = create.isPending || patch.isPending
  const [name, setName] = useState('')
  const [scopes, setScopes] = useState<ChatScope[]>([])
  const [grants, setGrants] = useState<IntegrationGrantInput[]>([])
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [formError, setFormError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setName(integration?.name ?? '')
    setScopes(integration?.scopes ?? ['chat:turn', 'chat:suggest'])
    setGrants(integration ? integration.grants.map((g) => ({ ...g })) : [])
    setErrors({})
    setFormError(null)
  }, [open, integration])

  const toggleScope = (s: ChatScope, on: boolean) => {
    setScopes((cur) => (on ? CHAT_SCOPES.filter((x) => cur.includes(x) || x === s) : cur.filter((x) => x !== s)))
    if (!on) setGrants((gs) => gs.map((g) => ({ ...g, scopes: g.scopes.filter((x) => x !== s) })))
  }
  const toggleGrantScope = (clientId: Id, s: ChatScope) =>
    setGrants((gs) =>
      gs.map((g) => (g.client_id === clientId ? { ...g, scopes: g.scopes.includes(s) ? g.scopes.filter((x) => x !== s) : [...g.scopes, s] } : g)),
    )

  const free = workspaces.filter((w) => !grants.some((g) => g.client_id === w.tenant_id))

  const submit = async () => {
    const e: Record<string, string> = {}
    if (name.trim().length < 2) e.name = t('chat.form.errName')
    if (!scopes.length) e.scopes = t('chat.form.errScopes')
    setErrors(e)
    setFormError(null)
    if (Object.keys(e).length) return
    try {
      if (integration) {
        await patch.mutateAsync({ id: integration.id, name: name.trim(), scopes, grants })
        toast.success(t('chat.toast.updated', { name: name.trim() }))
      } else {
        const r = await create.mutateAsync({ name: name.trim(), scopes, grants })
        onCreated(r.secret, r.integration.name)
      }
      onOpenChange(false)
    } catch (error) {
      const next: Record<string, string> = {}
      for (const f of ['name', 'scopes', 'grants']) {
        const m = fieldError(error, f)
        if (m) next[f] = m
      }
      setErrors(next)
      if (!Object.keys(next).length) setFormError(errorMessage(error))
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      size="lg"
      locked={pending}
      title={integration ? t('chat.form.editTitle') : t('chat.form.createTitle')}
      description={integration ? t('chat.form.editDescription') : t('chat.form.createDescription')}
      footer={
        <>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={pending}>
            {t('actions.cancel', { ns: 'common' })}
          </Button>
          <Button variant="primary" onClick={submit} loading={pending} className="min-w-28">
            {integration ? t('save') : t('chat.form.create')}
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        <Field label={t('chat.form.name')} error={errors.name}>
          <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={60} placeholder={t('chat.form.namePh')} autoFocus />
        </Field>

        <fieldset>
          <legend className="text-[13px] font-medium">{t('chat.form.scopes')}</legend>
          <p className="mb-2 text-xs text-muted">{t('chat.form.scopesHint')}</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {CHAT_SCOPES.map((s) => (
              <Checkbox
                key={s}
                checked={scopes.includes(s)}
                onCheckedChange={(on) => toggleScope(s, on)}
                label={<span className="font-mono text-[13px]">{s}</span>}
                description={t(`scopes.${scopeKey(s)}`)}
              />
            ))}
          </div>
          {errors.scopes ? <p role="alert" className="mt-1.5 text-xs text-danger">{errors.scopes}</p> : null}
        </fieldset>

        <section>
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h4 className="text-[13px] font-medium">{t('chat.form.grants')}</h4>
              <p className="text-xs text-muted">{t('chat.form.grantsHint')}</p>
            </div>
            <div className="w-full sm:w-64">
              <Select
                size="sm"
                value={undefined}
                onValueChange={(id) => setGrants((gs) => [...gs, { client_id: id, scopes: [...scopes], is_active: true }])}
                placeholder={free.length ? t('chat.form.addWorkspace') : t('chat.form.allGranted')}
                disabled={!free.length}
                options={free.map((w) => ({ value: w.tenant_id, label: workspaceName(w, lang), hint: w.is_active ? undefined : t('chat.inactiveWorkspace') }))}
              />
            </div>
          </div>
          {grants.length ? (
            <ul className="mt-3 divide-y divide-line rounded-ctl border border-line">
              {grants.map((g) => {
                const w = workspaces.find((x) => x.tenant_id === g.client_id)
                return (
                  <li key={g.client_id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-3 py-2.5">
                    <span className="min-w-36 flex-1 text-[13px] font-medium">{workspaceName(w, lang, g.client_id)}</span>
                    <div className="flex flex-wrap gap-1.5">
                      {scopes.map((s) => (
                        <FilterChip key={s} active={g.scopes.includes(s)} onClick={() => toggleGrantScope(g.client_id, s)}>
                          <span className="font-mono text-xs">{s}</span>
                        </FilterChip>
                      ))}
                    </div>
                    <Switch
                      size="sm"
                      checked={g.is_active}
                      onCheckedChange={(on) => setGrants((gs) => gs.map((x) => (x.client_id === g.client_id ? { ...x, is_active: on } : x)))}
                      label={t('chat.form.grantActive')}
                    />
                    <IconButton label={t('chat.form.removeGrant')} icon={<Trash2 />} size="sm" onClick={() => setGrants((gs) => gs.filter((x) => x.client_id !== g.client_id))} />
                  </li>
                )
              })}
            </ul>
          ) : (
            <p className="mt-3 flex items-center gap-2 rounded-ctl border border-dashed border-line px-3 py-3 text-[13px] text-muted">
              <Plus className="size-4" aria-hidden /> {t('chat.form.noGrants')}
            </p>
          )}
          {errors.grants ? <p role="alert" className="mt-1.5 text-xs text-danger">{errors.grants}</p> : null}
        </section>

        {formError ? <p role="alert" className="text-[13px] text-danger">{formError}</p> : null}
      </div>
    </Dialog>
  )
}
