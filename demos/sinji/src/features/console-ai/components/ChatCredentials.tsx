/** Chat-service credentials for the web chat platform: scopes, grants, rotation with overlap, revoke, diagnose. */
import { useState } from 'react'
import { KeyRound, Pencil, Plus, RefreshCw, ScanSearch, ShieldAlert } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { errorMessage } from '@/api/client'
import { Badge, Button, Callout, Card, ConfirmDialog, EmptyState, Panel, SecretOnceDialog, StatusChip, Switch, toast } from '@/components/ui'
import { cn } from '@/lib/cn'
import { formatDate, formatRelative } from '@/lib/format'
import type { Integration, IntegrationSecret } from '@/types'
import { useAssignments, useIntegrations, usePatchIntegration, useRevokeSecret, useRotateIntegration } from '../api'
import type { IntegrationSecretOnce } from '../types'
import { QueryState } from './bits'
import { DiagnoseDialog } from './DiagnoseDialog'
import { IntegrationDialog, workspaceName } from './IntegrationDialog'

const DAY = 86_400_000

type SecretState = { kind: 'revoked' | 'expired' | 'rotating' | 'current'; daysLeft?: number }
function secretState(s: IntegrationSecret, now = Date.now()): SecretState {
  if (s.revoked_at) return { kind: 'revoked' }
  if (s.expires_at) {
    const left = Date.parse(s.expires_at) - now
    return left <= 0 ? { kind: 'expired' } : { kind: 'rotating', daysLeft: Math.max(1, Math.ceil(left / DAY)) }
  }
  return { kind: 'current' }
}

interface Shown {
  secret: string
  keyId: string
  name: string
  rotated: boolean
  until?: string
}

export function ChatCredentials() {
  const { t, i18n } = useTranslation('consoleAi')
  const lang = i18n.language
  const query = useIntegrations()
  const assignments = useAssignments()
  const patch = usePatchIntegration()
  const rotate = useRotateIntegration()
  const revoke = useRevokeSecret()
  const workspaces = assignments.data?.rows ?? []

  const [editing, setEditing] = useState<{ open: boolean; integration: Integration | null }>({ open: false, integration: null })
  const [diagnosing, setDiagnosing] = useState<Integration | null>(null)
  const [toRotate, setToRotate] = useState<Integration | null>(null)
  const [toRevoke, setToRevoke] = useState<{ integration: Integration; secret: IntegrationSecret } | null>(null)
  const [shown, setShown] = useState<Shown | null>(null)

  const setActive = async (i: Integration, is_active: boolean) => {
    try {
      await patch.mutateAsync({ id: i.id, is_active })
      toast.success(t(is_active ? 'chat.toast.activated' : 'chat.toast.deactivated', { name: i.name }))
    } catch (e) {
      toast.error(errorMessage(e))
    }
  }

  return (
    <Panel
      title={t('chat.title')}
      description={t('chat.description')}
      icon={<KeyRound />}
      actions={
        <Button variant="primary" icon={<Plus />} onClick={() => setEditing({ open: true, integration: null })}>
          {t('chat.new')}
        </Button>
      }
    >
      <QueryState loading={query.isLoading} error={query.error} onRetry={() => void query.refetch()} rows={2}>
        {query.data && query.data.length === 0 ? (
          <EmptyState compact title={t('chat.empty.title')} body={t('chat.empty.body')} />
        ) : (
          <ul className="space-y-4">
            {(query.data ?? []).map((i) => {
              const live = i.secrets.some((s) => ['current', 'rotating'].includes(secretState(s).kind))
              const rotating = i.secrets.filter((s) => secretState(s).kind === 'rotating')
              const until = rotating.map((s) => s.expires_at ?? '').sort().pop()
              return (
                <li key={i.id}>
                  <Card className={cn(!i.is_active && 'bg-sunken/60')}>
                    <div className="flex flex-wrap items-start gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="font-display text-lg font-semibold">{i.name}</h3>
                          <StatusChip tone={i.is_active ? 'success' : 'neutral'}>{i.is_active ? t('chat.active') : t('chat.inactive')}</StatusChip>
                          {!live ? <Badge tone="danger">{t('chat.noLiveSecret')}</Badge> : null}
                        </div>
                        <p className="mt-0.5 text-xs text-muted">
                          <span className="font-mono">{i.id}</span> · {t('chat.created', { when: formatDate(i.created_at, lang) })}
                        </p>
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {i.scopes.map((s) => (
                            <Badge key={s} shape="tag" tone="primary" className="font-mono">
                              {s}
                            </Badge>
                          ))}
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Switch size="sm" checked={i.is_active} onCheckedChange={(on) => void setActive(i, on)} label={t('chat.active')} />
                        <Button size="sm" variant="secondary" icon={<Pencil />} onClick={() => setEditing({ open: true, integration: i })}>
                          {t('chat.edit')}
                        </Button>
                        <Button size="sm" variant="secondary" icon={<RefreshCw />} onClick={() => setToRotate(i)} disabled={!i.is_active}>
                          {t('chat.rotate')}
                        </Button>
                        <Button size="sm" variant="secondary" icon={<ScanSearch />} onClick={() => setDiagnosing(i)}>
                          {t('chat.diagnose')}
                        </Button>
                      </div>
                    </div>

                    {until ? (
                      <Callout tone="warning" className="mt-4" icon={<ShieldAlert />} title={t('chat.overlap.title')}>
                        {t('chat.overlap.body', { date: formatDate(until, lang), days: Math.max(1, Math.ceil((Date.parse(until) - Date.now()) / DAY)) })}
                      </Callout>
                    ) : null}

                    <div className="mt-4 overflow-x-auto">
                      <table className="w-full min-w-[560px] text-left text-[13px]">
                        <caption className="sr-only">{t('chat.secrets.caption', { name: i.name })}</caption>
                        <thead>
                          <tr className="border-b border-line text-xs text-muted">
                            <th className="py-1.5 pr-3 font-medium">{t('chat.secrets.keyId')}</th>
                            <th className="py-1.5 pr-3 font-medium">{t('chat.secrets.label')}</th>
                            <th className="py-1.5 pr-3 font-medium">{t('chat.secrets.status')}</th>
                            <th className="py-1.5 pr-3 font-medium">{t('chat.secrets.lastUsed')}</th>
                            <th className="py-1.5 text-right font-medium">
                              <span className="sr-only">{t('chat.secrets.actions')}</span>
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {i.secrets.map((s) => {
                            const st = secretState(s)
                            return (
                              <tr key={s.key_id} className="border-b border-line/60 last:border-0">
                                <td className="py-2 pr-3 align-top">
                                  <div className="font-mono text-xs">{s.key_id}</div>
                                  <div className="font-mono text-xs text-subtle">{s.hint}</div>
                                </td>
                                <td className="py-2 pr-3 align-top">
                                  <div>{s.label}</div>
                                  <div className="text-xs text-subtle">{t('chat.created', { when: formatDate(s.created_at, lang) })}</div>
                                </td>
                                <td className="py-2 pr-3 align-top">
                                  {st.kind === 'current' ? <StatusChip tone="success">{t('chat.secrets.current')}</StatusChip> : null}
                                  {st.kind === 'rotating' ? (
                                    <>
                                      <StatusChip tone="warning">{t('chat.secrets.rotating')}</StatusChip>
                                      <div className="mt-0.5 text-xs text-muted">{t('chat.secrets.until', { date: formatDate(s.expires_at, lang), days: st.daysLeft })}</div>
                                    </>
                                  ) : null}
                                  {st.kind === 'expired' ? <StatusChip tone="neutral">{t('chat.secrets.expired')}</StatusChip> : null}
                                  {st.kind === 'revoked' ? (
                                    <>
                                      <StatusChip tone="danger">{t('chat.secrets.revoked')}</StatusChip>
                                      <div className="mt-0.5 text-xs text-muted">{formatDate(s.revoked_at, lang)}</div>
                                    </>
                                  ) : null}
                                </td>
                                <td className="tabular py-2 pr-3 align-top text-muted">{s.last_used_at ? formatRelative(s.last_used_at, lang) : t('chat.secrets.never')}</td>
                                <td className="py-2 text-right align-top">
                                  {st.kind === 'current' || st.kind === 'rotating' ? (
                                    <Button size="xs" variant="danger-ghost" onClick={() => setToRevoke({ integration: i, secret: s })}>
                                      {t('chat.secrets.revoke')}
                                    </Button>
                                  ) : null}
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>

                    <div className="mt-4 border-t border-line pt-3">
                      <h4 className="mb-2 text-xs font-medium text-muted">{t('chat.grants.title')}</h4>
                      {i.grants.length ? (
                        <ul className="flex flex-wrap gap-2">
                          {i.grants.map((g) => {
                            const w = workspaces.find((x) => x.tenant_id === g.client_id)
                            return (
                              <li
                                key={g.client_id}
                                className={cn('rounded-ctl border border-line px-2.5 py-1.5 text-[13px]', !g.is_active && 'opacity-60')}
                              >
                                <span className="font-medium">{workspaceName(w, lang, g.client_id)}</span>
                                {!g.is_active ? <span className="ml-1.5 text-xs text-muted">({t('chat.grants.off')})</span> : null}
                                <span className="ml-2 font-mono text-xs text-muted">{g.scopes.map((s) => s.replace('chat:', '')).join(' · ') || '—'}</span>
                              </li>
                            )
                          })}
                        </ul>
                      ) : (
                        <p className="text-[13px] text-muted">{t('chat.grants.none')}</p>
                      )}
                    </div>
                  </Card>
                </li>
              )
            })}
          </ul>
        )}
      </QueryState>

      <IntegrationDialog
        open={editing.open}
        onOpenChange={(open) => setEditing((s) => ({ ...s, open }))}
        integration={editing.integration}
        workspaces={workspaces}
        onCreated={(secret, name) => setShown({ secret: secret.secret, keyId: secret.key_id, name, rotated: false })}
      />
      <DiagnoseDialog open={diagnosing !== null} onOpenChange={(o) => !o && setDiagnosing(null)} integration={diagnosing} workspaces={workspaces} />

      <ConfirmDialog
        open={toRotate !== null}
        onOpenChange={(o) => !o && setToRotate(null)}
        title={t('chat.rotateDialog.title', { name: toRotate?.name })}
        body={t('chat.rotateDialog.body')}
        confirmLabel={t('chat.rotateDialog.confirm')}
        onConfirm={async () => {
          if (!toRotate) return
          try {
            const r = await rotate.mutateAsync(toRotate.id)
            const s: IntegrationSecretOnce = r.secret
            setShown({ secret: s.secret, keyId: s.key_id, name: toRotate.name, rotated: true, until: r.overlap_until })
          } catch (e) {
            toast.error(errorMessage(e))
          }
          setToRotate(null)
        }}
      />

      <ConfirmDialog
        open={toRevoke !== null}
        onOpenChange={(o) => !o && setToRevoke(null)}
        title={t('chat.revokeDialog.title', { key: toRevoke?.secret.key_id })}
        body={t('chat.revokeDialog.body')}
        confirmLabel={t('chat.revokeDialog.confirm')}
        danger
        onConfirm={async () => {
          if (!toRevoke) return
          try {
            await revoke.mutateAsync({ id: toRevoke.integration.id, keyId: toRevoke.secret.key_id })
            toast.success(t('chat.toast.revoked', { key: toRevoke.secret.key_id }))
          } catch (e) {
            toast.error(errorMessage(e))
          }
          setToRevoke(null)
        }}
      />

      <SecretOnceDialog
        open={shown !== null}
        onOpenChange={(o) => !o && setShown(null)}
        secret={shown?.secret ?? null}
        title={shown?.rotated ? t('chat.secretDialog.rotatedTitle', { name: shown.name }) : t('chat.secretDialog.createdTitle', { name: shown?.name })}
        label={t('chat.secretDialog.label')}
        note={
          <span className="block space-y-1">
            <span className="block">
              {t('chat.secretDialog.keyId')} <span className="font-mono">{shown?.keyId}</span>
            </span>
            {shown?.rotated && shown.until ? <span className="block">{t('chat.secretDialog.overlap', { date: formatDate(shown.until, lang) })}</span> : null}
          </span>
        }
      />
    </Panel>
  )
}
