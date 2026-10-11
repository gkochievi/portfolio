import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button, Callout, Card, Field, Skeleton, Switch, Textarea, toast } from '@/components/ui'
import { useAnonymousLimits, useErrorText, useSaveAnonymous } from '../api'
import { LimitsFields } from '../components/LimitsFields'
import { fromDraft, serverToDraftField, toDraft, type LimitsDraft } from '../components/limits'
import type { AnonymousPayload } from '../types'

/** Console > Anonymous limits: allowances for visitors who are not signed in, and the public sentiment read. */
export default function AnonymousLimitsPage() {
  const { t } = useTranslation('consolePlatform')
  const query = useAnonymousLimits()
  if (query.isError)
    return (
      <Callout
        tone="danger"
        title={t('errors.loadFailed')}
        action={
          <Button size="sm" onClick={() => void query.refetch()}>
            {t('actions.retry')}
          </Button>
        }
      />
    )
  if (!query.data) return <Skeleton className="h-96 w-full" />
  return <AnonymousForm key={JSON.stringify(query.data)} saved={query.data} />
}

function AnonymousForm({ saved }: { saved: AnonymousPayload }) {
  const { t } = useTranslation('consolePlatform')
  const errorText = useErrorText()
  const save = useSaveAnonymous()
  const [draft, setDraft] = useState<LimitsDraft>(() => toDraft(saved.limits))
  const [sentiment, setSentiment] = useState(saved.public_sentiment)
  const [errors, setErrors] = useState<Record<string, string>>({})

  const dirty =
    JSON.stringify(draft) !== JSON.stringify(toDraft(saved.limits)) ||
    sentiment.enabled !== saved.public_sentiment.enabled ||
    sentiment.guidance !== saved.public_sentiment.guidance

  const submit = async () => {
    const { config, errors: found } = fromDraft(draft)
    const next = Object.fromEntries(Object.entries(found).map(([k, code]) => [k, t(`errors.${code}`)]))
    if (sentiment.guidance.length > 1000) next.guidance = t('errors.too_long')
    if (!config || next.guidance) {
      setErrors(next)
      return
    }
    try {
      await save.mutateAsync({ limits: config, public_sentiment: sentiment })
      setErrors({})
      toast.success(t('anonymous.toast'))
    } catch (e) {
      const fields = errorText.fields(e)
      setErrors(Object.fromEntries(Object.entries(fields).map(([k, v]) => [serverToDraftField[k] ?? k, v])))
      if (!Object.keys(fields).length) toast.error(errorText.text(e))
    }
  }

  return (
    <form
        noValidate
      className="animate-panel-in space-y-5"
      onSubmit={(e) => {
        e.preventDefault()
        void submit()
      }}
    >
      <div>
        <h2 className="font-display text-xl font-semibold text-ink">{t('anonymous.title')}</h2>
        <p className="mt-1 max-w-2xl text-sm text-muted">{t('anonymous.description')}</p>
      </div>

      <Card>
        <h3 className="font-display text-lg font-semibold text-ink">{t('anonymous.limitsTitle')}</h3>
        <p className="mb-4 mt-0.5 text-sm text-muted">{t('anonymous.limitsDescription')}</p>
        <LimitsFields draft={draft} onChange={setDraft} errors={errors} enabledLabel={t('anonymous.enabled')} enabledHint={t('anonymous.enabledHint')} />
      </Card>

      <Card>
        <h3 className="font-display text-lg font-semibold text-ink">{t('anonymous.sentimentTitle')}</h3>
        <p className="mb-4 mt-0.5 text-sm text-muted">{t('anonymous.sentimentDescription')}</p>
        <div className="space-y-4">
          <Switch
            checked={sentiment.enabled}
            onCheckedChange={(enabled) => setSentiment({ ...sentiment, enabled })}
            label={t('anonymous.sentimentEnabled')}
          />
          <Field label={t('anonymous.guidance')} hint={t('anonymous.guidanceHint')} error={errors.guidance}>
            <Textarea
              rows={5}
              value={sentiment.guidance}
              onChange={(e) => setSentiment({ ...sentiment, guidance: e.target.value })}
            />
          </Field>
          <p className="tabular text-right text-xs text-muted">{t('anonymous.guidanceCount', { count: sentiment.guidance.length })}</p>
        </div>
      </Card>

      <div className="flex flex-wrap gap-2">
        <Button type="submit" variant="primary" loading={save.isPending} disabled={!dirty}>
          {t('actions.save')}
        </Button>
        <Button
          type="button"
          variant="ghost"
          disabled={!dirty || save.isPending}
          onClick={() => {
            setDraft(toDraft(saved.limits))
            setSentiment(saved.public_sentiment)
            setErrors({})
          }}
        >
          {t('actions.discard')}
        </Button>
      </div>
    </form>
  )
}
