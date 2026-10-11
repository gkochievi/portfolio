/** Diagnose a credential against a workspace: a verdict code plus a plain-language explanation. */
import { useEffect, useState } from 'react'
import { CheckCircle2, ScanSearch, XCircle } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { errorMessage } from '@/api/client'
import { Badge, Button, Dialog, Field, Input, Select } from '@/components/ui'
import { cn } from '@/lib/cn'
import type { ChatScope, Id, Integration } from '@/types'
import { useDiagnose } from '../api'
import { CHAT_SCOPES, type AssignmentRow, type DiagnoseResult } from '../types'
import { workspaceName } from './IntegrationDialog'

const ANY = '__any'

export function DiagnoseDialog({
  open,
  onOpenChange,
  integration,
  workspaces,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  integration: Integration | null
  workspaces: AssignmentRow[]
}) {
  const { t, i18n } = useTranslation('consoleAi')
  const lang = i18n.language
  const diagnose = useDiagnose()
  const [keyId, setKeyId] = useState('')
  const [clientId, setClientId] = useState<Id>('')
  const [scope, setScope] = useState<string>(ANY)
  const [result, setResult] = useState<DiagnoseResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [keyError, setKeyError] = useState<string | undefined>()

  useEffect(() => {
    if (!open || !integration) return
    const live = [...integration.secrets].filter((s) => !s.revoked_at).sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at))[0]
    setKeyId(live?.key_id ?? integration.secrets[0]?.key_id ?? '')
    setClientId(integration.grants[0]?.client_id ?? workspaces[0]?.tenant_id ?? '')
    setScope(ANY)
    setResult(null)
    setError(null)
    setKeyError(undefined)
  }, [open, integration, workspaces])

  const reset = () => {
    setResult(null)
    setError(null)
  }

  const run = async () => {
    if (!integration) return
    if (!keyId.trim()) return setKeyError(t('diagnose.errKey'))
    setKeyError(undefined)
    reset()
    try {
      setResult(await diagnose.mutateAsync({ id: integration.id, key_id: keyId.trim(), client_id: clientId, ...(scope !== ANY ? { scope } : {}) }))
    } catch (e) {
      setError(errorMessage(e))
    }
  }

  const ok = result?.verdict === 'ok'

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      size="md"
      title={t('diagnose.title')}
      description={t('diagnose.description', { name: integration?.name ?? '' })}
      footer={
        <>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            {t('actions.close', { ns: 'common' })}
          </Button>
          <Button variant="primary" icon={<ScanSearch />} loading={diagnose.isPending} onClick={run} className="min-w-28" disabled={!clientId}>
            {t('diagnose.run')}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label={t('diagnose.keyId')} error={keyError} hint={t('diagnose.keyIdHint')}>
          <Input mono value={keyId} onChange={(e) => { setKeyId(e.target.value); reset() }} placeholder="snjk_…" autoComplete="off" spellCheck={false} />
        </Field>
        {integration?.secrets.length ? (
          <div className="-mt-2 flex flex-wrap gap-1.5">
            {integration.secrets.map((s) => (
              <button
                key={s.key_id}
                type="button"
                onClick={() => { setKeyId(s.key_id); reset() }}
                className={cn(
                  'rounded-pill border px-2 py-0.5 font-mono text-xs transition-colors hover:border-line-strong',
                  keyId === s.key_id ? 'border-primary/50 bg-primary/10 text-primary' : 'border-line text-muted',
                )}
              >
                {s.key_id}
              </button>
            ))}
          </div>
        ) : null}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t('diagnose.workspace')}>
            <Select
              value={clientId || undefined}
              onValueChange={(v) => { setClientId(v); reset() }}
              placeholder={t('diagnose.workspacePh')}
              options={workspaces.map((w) => ({ value: w.tenant_id, label: workspaceName(w, lang), hint: w.is_active ? undefined : t('chat.inactiveWorkspace') }))}
            />
          </Field>
          <Field label={t('diagnose.scope')}>
            <Select
              value={scope}
              onValueChange={(v) => { setScope(v); reset() }}
              options={[{ value: ANY, label: t('diagnose.anyScope') }, ...CHAT_SCOPES.map((s: ChatScope) => ({ value: s, label: s }))]}
            />
          </Field>
        </div>

        <div aria-live="polite">
          {error ? <p role="alert" className="text-[13px] text-danger">{error}</p> : null}
          {result ? (
            <div className={cn('rounded-card border p-4', ok ? 'border-success/40 bg-success/8' : 'border-danger/40 bg-danger/8')}>
              <div className="flex flex-wrap items-center gap-2">
                {ok ? <CheckCircle2 className="size-5 text-success" aria-hidden /> : <XCircle className="size-5 text-danger" aria-hidden />}
                <h4 className="font-display text-lg font-semibold">{t(`diagnose.verdicts.${result.verdict}.title`)}</h4>
                <Badge tone={ok ? 'success' : 'danger'} className="font-mono">
                  {result.verdict}
                </Badge>
              </div>
              <p className="mt-2 text-[13px]">{t(`diagnose.verdicts.${result.verdict}.explain`)}</p>
              <p className="mt-2 text-[13px] text-muted">
                <span className="font-medium text-ink">{t('diagnose.fix')}</span> {t(`diagnose.verdicts.${result.verdict}.fix`)}
              </p>
            </div>
          ) : null}
        </div>
      </div>
    </Dialog>
  )
}
