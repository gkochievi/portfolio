/** Score colour bands: amber_from / green_from with a three-range preview. OWNED BY: workspace-settings. */
import { RotateCcw } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button, Callout, Field, Input, Panel, ReadOnlyNote, Skeleton, toast } from '@/components/ui'
import { DEFAULT_BANDS } from '@/lib/scoring'
import { useCanEdit } from '@/lib/session'
import type { ScoreBands } from '@/types'
import { errorMessage, useBands, useResetBands, useSaveBands } from '../api'

const parse = (value: string): number => (value.trim() === '' ? NaN : Number(value))

export function BandPreview({ amber, green }: { amber: number; green: number }) {
  const { t } = useTranslation('settings')
  const valid = Number.isInteger(amber) && Number.isInteger(green) && amber >= 1 && green <= 100 && amber < green
  const a = valid ? amber : DEFAULT_BANDS.amber_from
  const g = valid ? green : DEFAULT_BANDS.green_from
  const segments = [
    { key: 'low', width: a, className: 'bg-danger text-white', label: t('bands.low'), range: `0-${a - 1}` },
    { key: 'mid', width: g - a, className: 'bg-warning text-white', label: t('bands.mid'), range: `${a}-${g - 1}` },
    { key: 'high', width: 100 - g + 1, className: 'bg-success text-white', label: t('bands.high'), range: `${g}-100` },
  ]
  return (
    <div className={valid ? '' : 'opacity-50'} aria-hidden={!valid}>
      <div className="flex h-9 overflow-hidden rounded-ctl border border-line" role="img" aria-label={t('bands.previewLabel', { amber: a, green: g })}>
        {segments.map((s) => (
          <div key={s.key} style={{ width: `${s.width}%` }} className={`${s.className} tabular grid min-w-0 place-items-center truncate px-1 text-xs font-medium`}>
            {s.range}
          </div>
        ))}
      </div>
      <div className="mt-1.5 flex text-xs text-muted">
        {segments.map((s) => (
          <div key={s.key} style={{ width: `${s.width}%` }} className="min-w-0 truncate pr-1">
            {s.label}
          </div>
        ))}
      </div>
    </div>
  )
}

function BandsForm({ bands, canEdit }: { bands: ScoreBands; canEdit: boolean }) {
  const { t } = useTranslation('settings')
  const save = useSaveBands()
  const reset = useResetBands()
  const [amber, setAmber] = useState(String(bands.amber_from))
  const [green, setGreen] = useState(String(bands.green_from))
  const [error, setError] = useState<string | null>(null)

  const a = parse(amber)
  const g = parse(green)
  const amberError = !Number.isInteger(a) || a < 1 || a > 99 ? t('bands.errors.amber') : null
  const greenError = !Number.isInteger(g) || g < 2 || g > 100 ? t('bands.errors.green') : !amberError && a >= g ? t('bands.errors.order') : null
  const dirty = a !== bands.amber_from || g !== bands.green_from
  const atDefault = bands.amber_from === DEFAULT_BANDS.amber_from && bands.green_from === DEFAULT_BANDS.green_from

  const submit = async () => {
    setError(null)
    if (amberError || greenError) return
    try {
      await save.mutateAsync({ amber_from: a, green_from: g })
      toast.success(t('bands.saved'))
    } catch (e) {
      setError(errorMessage(e, t('bands.failed')))
    }
  }

  const doReset = async () => {
    setError(null)
    try {
      await reset.mutateAsync()
      setAmber(String(DEFAULT_BANDS.amber_from))
      setGreen(String(DEFAULT_BANDS.green_from))
      toast.success(t('bands.resetDone'))
    } catch (e) {
      setError(errorMessage(e, t('bands.failed')))
    }
  }

  return (
    <div className="space-y-5">
      {canEdit ? null : <ReadOnlyNote />}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t('bands.amber')} hint={t('bands.amberHint')} error={canEdit ? amberError : null}>
          <Input type="number" inputMode="numeric" min={1} max={99} className="tabular" value={amber} disabled={!canEdit} onChange={(e) => setAmber(e.target.value)} />
        </Field>
        <Field label={t('bands.green')} hint={t('bands.greenHint')} error={canEdit ? greenError : null}>
          <Input type="number" inputMode="numeric" min={2} max={100} className="tabular" value={green} disabled={!canEdit} onChange={(e) => setGreen(e.target.value)} />
        </Field>
      </div>
      <BandPreview amber={a} green={g} />
      {error ? <Callout tone="danger">{error}</Callout> : null}
      {canEdit ? (
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="primary" loading={save.isPending} disabled={!dirty || Boolean(amberError || greenError)} onClick={() => void submit()} className="min-w-24">
            {t('bands.save')}
          </Button>
          <Button variant="ghost" icon={<RotateCcw />} loading={reset.isPending} disabled={atDefault && !dirty} onClick={() => void doReset()}>
            {t('bands.reset')}
          </Button>
        </div>
      ) : null}
    </div>
  )
}

export default function BandsCard() {
  const { t } = useTranslation('settings')
  const canEdit = useCanEdit()
  const bands = useBands()
  return (
    <Panel title={t('bands.title')} description={t('bands.description')}>
      {bands.isLoading ? (
        <Skeleton className="h-40 w-full" />
      ) : bands.isError || !bands.data ? (
        <Callout tone="danger" action={<Button size="sm" onClick={() => void bands.refetch()}>{t('retry')}</Button>}>
          {t('loadError')}
        </Callout>
      ) : (
        <BandsForm key={`${bands.data.amber_from}-${bands.data.green_from}`} bands={bands.data} canEdit={canEdit} />
      )}
    </Panel>
  )
}
