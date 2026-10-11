import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Activity, Save } from 'lucide-react'

import { errorMessage } from '@/api/client'
import { Badge, Button, Card, CardHeader, ErrorState, Field, Input, PageHeader, Skeleton, Switch, toast, type BadgeTone } from '@/components/ui'
import { formatDateTime } from '@/lib/format'

import { useAiLink, useSaveAiLink, useTestAiLink } from '../api'
import { BackLink, Notice, SummaryRow, useFieldMessage, useLang } from '../components/shared'
import type { AiTestResult } from '../types'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const CIRCUIT_TONE: Record<'closed' | 'open' | 'half_open', BadgeTone> = { closed: 'success', open: 'danger', half_open: 'warning' }

export default function AiLinkPage() {
  const { t } = useTranslation(['adminIntegrations', 'common'])
  const lang = useLang()
  const query = useAiLink()
  const save = useSaveAiLink()
  const test = useTestAiLink()
  const message = useFieldMessage()
  const link = query.data
  const [clientId, setClientId] = useState('')
  const [touched, setTouched] = useState(false)
  const [result, setResult] = useState<AiTestResult | null>(null)

  useEffect(() => {
    if (link && !touched) setClientId(link.aiClientId ?? '')
  }, [link, touched])

  const header = (
    <>
      <BackLink />
      <PageHeader title={t('ai.title')} description={t('ai.description')} />
    </>
  )

  if (query.isError && !link) {
    return (
      <div>
        {header}
        <ErrorState title={t('ai.loadError')} description={errorMessage(query.error)} onRetry={() => void query.refetch()} retryLabel={t('common:actions.retry')} />
      </div>
    )
  }

  if (!link) {
    return (
      <div>
        {header}
        <Skeleton className="mb-4 h-24 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  const trimmed = clientId.trim()
  const localInvalid = trimmed !== '' && !UUID.test(trimmed)
  const serverError = message(save.error, 'aiClientId')
  const idError = localInvalid ? t('errors.invalid_uuid') : serverError
  const dirtyId = trimmed.toLowerCase() !== (link.aiClientId ?? '')

  const persist = async (next: { aiClientId: string; aiBotEnabled: boolean }, successKey: string) => {
    try {
      await save.mutateAsync(next)
      setTouched(false)
      toast.success(t(successKey))
    } catch (error) {
      if (!message(error, 'aiClientId')) toast.error(errorMessage(error))
      else if (next.aiClientId === (link.aiClientId ?? '')) toast.error(message(error, 'aiClientId') as string)
    }
  }

  const runTest = async () => {
    setResult(null)
    try {
      setResult(await test.mutateAsync())
    } catch (error) {
      toast.error(errorMessage(error))
    }
  }

  const circuit = link.circuit

  return (
    <div>
      {header}

      <Card className="mb-4 flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Badge tone={link.live ? 'success' : 'neutral'} size="md" dot>
              {link.live ? t('ai.status.live') : t('ai.status.notLive')}
            </Badge>
            <p className="text-sm text-muted">{link.live ? t('ai.status.liveHint') : t('ai.status.notLiveHint')}</p>
          </div>
        </div>
        {!link.live && link.reasons.length > 0 ? (
          <Notice tone="warning" title={t('ai.reasons.title')}>
            <ul className="list-disc pl-4">
              {link.reasons.map((reason) => (
                <li key={reason}>{t(`ai.reasons.${reason}`)}</li>
              ))}
            </ul>
          </Notice>
        ) : null}
      </Card>

      <div className="grid gap-4 lg:grid-cols-2 lg:items-start">
        <Card className="flex flex-col gap-5">
          <CardHeader title={t('ai.connection.title')} description={t('ai.connection.description')} />
          <Switch
            labelFirst
            label={t('ai.switch.label')}
            description={t('ai.switch.description')}
            checked={link.aiBotEnabled}
            disabled={save.isPending}
            onCheckedChange={(checked) => void persist({ aiClientId: link.aiClientId ?? '', aiBotEnabled: checked }, checked ? 'ai.toast.enabled' : 'ai.toast.disabled')}
          />
          <form
            className="flex flex-col gap-3"
            onSubmit={(event) => {
              event.preventDefault()
              if (localInvalid) return
              void persist({ aiClientId: trimmed, aiBotEnabled: link.aiBotEnabled && trimmed !== '' }, 'ai.toast.saved')
            }}
          >
            <Field label={t('ai.clientId.label')} hint={t('ai.clientId.hint')} error={idError}>
              <Input
                mono
                value={clientId}
                invalid={!!idError}
                placeholder="00000000-0000-0000-0000-000000000000"
                spellCheck={false}
                autoComplete="off"
                onChange={(event) => {
                  setTouched(true)
                  setClientId(event.target.value)
                }}
              />
            </Field>
            <div>
              <Button type="submit" size="sm" variant="primary" loading={save.isPending} disabled={!dirtyId || localInvalid} leftIcon={<Save size={16} strokeWidth={1.75} />}>
                {t('common:actions.save')}
              </Button>
            </div>
          </form>
        </Card>

        <Card className="flex flex-col gap-2">
          <CardHeader title={t('ai.state.title')} description={t('ai.state.description')} />
          <dl>
            <SummaryRow label={t('ai.state.server')}>
              <Badge tone={link.serverConfigured ? 'success' : 'danger'} size="sm">{link.serverConfigured ? t('ai.state.configured') : t('ai.state.notConfigured')}</Badge>
            </SummaryRow>
            <SummaryRow label={t('ai.state.autopilot')}>
              <Badge tone={link.autopilotEnabled ? 'success' : 'muted'} size="sm">{link.autopilotEnabled ? t('ai.state.on') : t('ai.state.off')}</Badge>
            </SummaryRow>
            <SummaryRow label={t('ai.state.circuit')}>
              <Badge tone={CIRCUIT_TONE[circuit.state]} size="sm" dot>{t(`ai.state.circuitValue.${circuit.state}`)}</Badge>
            </SummaryRow>
            {circuit.failures > 0 ? <SummaryRow label={t('ai.state.failures')}><span className="tabular">{circuit.failures}</span></SummaryRow> : null}
            {circuit.lastReason ? <SummaryRow label={t('ai.state.lastReason')}>{circuit.lastReason}</SummaryRow> : null}
            {circuit.openUntil ? <SummaryRow label={t('ai.state.openUntil')}>{formatDateTime(circuit.openUntil, lang)}</SummaryRow> : null}
            <SummaryRow label={t('ai.state.botPause')}>
              {link.botPause ? `${link.botPause.reason} · ${formatDateTime(link.botPause.until, lang)}` : <span className="text-muted">{t('ai.state.none')}</span>}
            </SummaryRow>
            <SummaryRow label={t('ai.state.lastTest')}>
              {link.lastTestAt ? (
                <span className="inline-flex items-center gap-2">
                  <Badge tone={link.lastTestOk ? 'success' : 'danger'} size="sm">{link.lastTestOk ? t('ai.test.passed') : t('ai.test.failed')}</Badge>
                  {formatDateTime(link.lastTestAt, lang)}
                </span>
              ) : (
                <span className="text-muted">{t('ai.state.never')}</span>
              )}
            </SummaryRow>
          </dl>
        </Card>
      </div>

      <Card className="mt-4 flex flex-col gap-4">
        <CardHeader
          title={t('ai.test.title')}
          description={t('ai.test.description')}
          actions={
            <Button variant="outline" size="sm" loading={test.isPending} leftIcon={<Activity size={16} strokeWidth={1.75} />} onClick={() => void runTest()}>
              {test.isPending ? t('ai.test.running') : t('ai.test.run')}
            </Button>
          }
        />
        {result ? (
          <>
            <pre
              aria-label={t('ai.test.output')}
              className="max-h-80 overflow-auto whitespace-pre-wrap break-words rounded-ui border border-line bg-sunken p-4 font-mono text-[12.5px] leading-relaxed text-ink"
            >
              {result.lines.join('\n')}
            </pre>
            <Notice tone={result.ok ? 'success' : 'danger'}>{result.ok ? t('ai.test.okSummary') : t('ai.test.failSummary')}</Notice>
          </>
        ) : (
          <p className="rounded-ui border border-dashed border-line-strong px-4 py-6 text-center text-sm text-muted">{test.isPending ? t('ai.test.running') : t('ai.test.idle')}</p>
        )}
      </Card>
    </div>
  )
}
