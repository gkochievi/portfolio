import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button, Callout, Card, Field, FilterChip, Input, Skeleton, toast } from '@/components/ui'
import { useErrorText, useSaveStorage, useStorage } from '../api'
import { parseWhole } from '../components/limits'

const PRESETS = [30, 90, 180, 365, 0]

/** Console > Retention: how many days recordings are kept (0 = forever). */
export default function StoragePage() {
  const { t } = useTranslation('consolePlatform')
  const storage = useStorage()
  if (storage.isError)
    return (
      <Callout
        tone="danger"
        title={t('errors.loadFailed')}
        action={
          <Button size="sm" onClick={() => void storage.refetch()}>
            {t('actions.retry')}
          </Button>
        }
      />
    )
  if (!storage.data) return <Skeleton className="h-52 w-full max-w-xl" />
  return <StorageForm key={storage.data.retention_days} saved={storage.data.retention_days} />
}

function StorageForm({ saved }: { saved: number }) {
  const { t } = useTranslation('consolePlatform')
  const errorText = useErrorText()
  const save = useSaveStorage()
  const [value, setValue] = useState(String(saved))
  const [error, setError] = useState<string>()
  const parsed = parseWhole(value, 0, 3650)
  const dirty = parsed !== saved

  const submit = async () => {
    if (parsed === null) {
      setError(t('errors.range_0_3650'))
      return
    }
    try {
      await save.mutateAsync(parsed)
      setError(undefined)
      toast.success(t('storage.toast'))
    } catch (e) {
      setError(errorText.fields(e).retention_days ?? errorText.text(e))
    }
  }

  return (
    <div className="animate-panel-in max-w-xl">
      <div className="mb-4">
        <h2 className="font-display text-xl font-semibold text-ink">{t('storage.title')}</h2>
        <p className="mt-1 text-sm text-muted">{t('storage.description')}</p>
      </div>
      <Card>
        <form
        noValidate
          className="space-y-5"
          onSubmit={(e) => {
            e.preventDefault()
            void submit()
          }}
        >
          <Field label={t('storage.days')} hint={t('storage.hint')} error={error}>
            <Input
              type="number"
              inputMode="numeric"
              min={0}
              max={3650}
              className="tabular"
              value={value}
              onChange={(e) => {
                setValue(e.target.value)
                setError(undefined)
              }}
            />
          </Field>
          <div className="flex flex-wrap gap-2" role="group" aria-label={t('storage.title')}>
            {PRESETS.map((days) => (
              <FilterChip key={days} active={parsed === days} onClick={() => setValue(String(days))}>
                {t(`storage.presets.${days}`)}
              </FilterChip>
            ))}
          </div>
          <p className="rounded-ctl bg-sunken px-3 py-2.5 text-sm text-muted" aria-live="polite">
            {parsed === 0 ? t('storage.forever') : parsed !== null ? t('storage.summary', { days: parsed }) : ''}
          </p>
          <div className="flex gap-2">
            <Button type="submit" variant="primary" loading={save.isPending} disabled={!dirty}>
              {t('actions.save')}
            </Button>
            <Button type="button" variant="ghost" disabled={!dirty || save.isPending} onClick={() => setValue(String(saved))}>
              {t('actions.discard')}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  )
}
