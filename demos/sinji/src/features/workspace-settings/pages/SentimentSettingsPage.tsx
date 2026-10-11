import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button, Callout, Field, Panel, ReadOnlyNote, Skeleton, StatusChip, Switch, Textarea, toast } from '@/components/ui'
import { useFormat } from '@/lib/format'
import { useCanEdit } from '@/lib/session'
import type { SentimentConfig, VoiceToneStatus } from '@/types'
import { errorMessage, useSaveSentiment, useSentiment } from '../api'

const TONES: Record<VoiceToneStatus, 'success' | 'info' | 'danger' | 'neutral'> = {
  ok: 'success',
  warming: 'info',
  model_error: 'danger',
  unreachable: 'danger',
  disabled: 'neutral',
}
const GUIDANCE_MAX = 2000

function SentimentForm({ config, canEdit }: { config: SentimentConfig; canEdit: boolean }) {
  const { t } = useTranslation('settings')
  const f = useFormat()
  const save = useSaveSentiment()
  const [enabled, setEnabled] = useState(config.enabled)
  const [guidance, setGuidance] = useState(config.guidance)
  const [error, setError] = useState<string | null>(null)
  const dirty = enabled !== config.enabled || guidance !== config.guidance

  const submit = async () => {
    setError(null)
    try {
      await save.mutateAsync({ enabled, guidance })
      toast.success(t('sentiment.saved'))
    } catch (e) {
      setError(errorMessage(e, t('sentiment.failed')))
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <Panel title={t('sentiment.title')} description={t('sentiment.description')}>
        <div className="space-y-5">
          {canEdit ? null : <ReadOnlyNote />}
          <Switch
            checked={enabled}
            onCheckedChange={setEnabled}
            disabled={!canEdit}
            label={t('sentiment.enable')}
            description={t('sentiment.enableHint')}
          />
          <Field
            label={t('sentiment.guidance')}
            hint={t('sentiment.guidanceHint', { n: guidance.length, max: GUIDANCE_MAX })}
            error={guidance.length > GUIDANCE_MAX ? t('sentiment.tooLong', { max: GUIDANCE_MAX }) : null}
          >
            <Textarea rows={7} value={guidance} disabled={!canEdit || !enabled} placeholder={t('sentiment.placeholder')} onChange={(e) => setGuidance(e.target.value)} />
          </Field>
          {error ? <Callout tone="danger">{error}</Callout> : null}
          {canEdit ? (
            <div className="flex flex-wrap items-center gap-3">
              <Button variant="primary" loading={save.isPending} disabled={!dirty || guidance.length > GUIDANCE_MAX} onClick={() => void submit()} className="min-w-24">
                {t('sentiment.save')}
              </Button>
              {config.updated_by ? <span className="text-xs text-muted">{t('rubric.lastSaved', { when: f.relative(config.updated_at), who: config.updated_by })}</span> : null}
            </div>
          ) : null}
        </div>
      </Panel>

      <Panel title={t('sentiment.service.title')} description={t('sentiment.service.description')}>
        <div className="space-y-3" aria-live="polite">
          <StatusChip tone={TONES[config.voice_tone]} pulse={config.voice_tone === 'warming'}>
            {t(`sentiment.status.${config.voice_tone}.label`)}
          </StatusChip>
          <p className="text-sm text-muted">{t(`sentiment.status.${config.voice_tone}.hint`)}</p>
        </div>
      </Panel>
    </div>
  )
}

/** Sentiment settings. OWNED BY: workspace-settings. */
export default function SentimentSettingsPage() {
  const { t } = useTranslation('settings')
  const canEdit = useCanEdit()
  const query = useSentiment()

  if (query.isLoading) return <Skeleton className="h-72 w-full" />
  if (query.isError || !query.data) {
    return (
      <Callout tone="danger" action={<Button size="sm" onClick={() => void query.refetch()}>{t('retry')}</Button>}>
        {t('loadError')}
      </Callout>
    )
  }
  const config = query.data
  return <SentimentForm key={`${config.updated_at}`} config={config} canEdit={canEdit} />
}
