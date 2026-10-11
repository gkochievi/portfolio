import { Search, RotateCcw } from 'lucide-react'
import { useEffect, useRef, useState, type FormEvent } from 'react'

import { Button, Card, CardBody, Field, Input, SegmentedControl } from '@/components/ui'
import type { CdrSourceFilter } from '@/types'
import { useCallLabels } from './useCallLabels'

export interface FormValues {
  number: string
  recordingFile: string
  from: string
  to: string
  source: CdrSourceFilter
}

export function SearchForm({
  values,
  onChange,
  onSubmit,
  onReset,
  searching,
  showSource,
}: {
  values: FormValues
  onChange: (patch: Partial<FormValues>) => void
  onSubmit: () => void
  onReset: () => void
  searching: boolean
  showSource: boolean
}) {
  const { t } = useCallLabels()
  const byFile = values.recordingFile.trim() !== ''
  const [touched, setTouched] = useState(false)
  const fromMs = values.from ? Date.parse(values.from) : NaN
  const toMs = values.to ? Date.parse(values.to) : NaN
  const errors: { from?: string; to?: string } = {}
  if (!byFile) {
    if (!values.from) errors.from = t('form.errors.from')
    if (!values.to) errors.to = t('form.errors.to')
    if (!errors.from && !errors.to && fromMs > toMs) errors.to = t('form.errors.order')
  }
  const invalid = !!(errors.from || errors.to)

  // Live elapsed timer while a search runs.
  const [elapsed, setElapsed] = useState(0)
  const startedAt = useRef(0)
  useEffect(() => {
    if (!searching) return
    startedAt.current = performance.now()
    setElapsed(0)
    const id = window.setInterval(() => setElapsed(performance.now() - startedAt.current), 100)
    return () => window.clearInterval(id)
  }, [searching])

  const submit = (e: FormEvent) => {
    e.preventDefault()
    setTouched(true)
    if (!invalid && !searching) onSubmit()
  }

  return (
    <Card>
      <CardBody>
        <form onSubmit={submit} noValidate className="grid gap-x-4 gap-y-3 sm:grid-cols-2 lg:grid-cols-6">
          <div className="lg:col-span-2">
            <Field label={t('form.number')} hint={byFile ? t('form.numberDisabled') : t('form.numberHint')} htmlFor="calls-number">
              <Input
                id="calls-number"
                mono
                inputMode="tel"
                autoComplete="off"
                value={values.number}
                disabled={byFile}
                placeholder={t('form.numberPlaceholder')}
                onChange={(e) => onChange({ number: e.target.value })}
              />
            </Field>
          </div>
          <div className="lg:col-span-2">
            <Field label={t('form.recordingFile')} hint={byFile ? t('form.datesIgnored') : t('form.recordingHint')} htmlFor="calls-file">
              <Input
                id="calls-file"
                mono
                autoComplete="off"
                spellCheck={false}
                value={values.recordingFile}
                placeholder={t('form.recordingPlaceholder')}
                onChange={(e) => onChange({ recordingFile: e.target.value })}
              />
            </Field>
          </div>
          {showSource && (
            <div className="sm:col-span-2 lg:col-span-2">
              <Field label={t('form.source')}>
                <SegmentedControl<CdrSourceFilter>
                  aria-label={t('form.source')}
                  value={values.source}
                  onChange={(source) => onChange({ source })}
                  options={[
                    { value: 'both', label: t('form.sourceBoth') },
                    { value: 'core', label: 'Core Cluster' },
                    { value: 'edge', label: 'Edge PBX' },
                  ]}
                />
              </Field>
            </div>
          )}
          <div className="lg:col-span-2">
            <Field label={t('form.from')} error={touched ? errors.from : undefined} htmlFor="calls-from">
              <Input
                id="calls-from"
                type="datetime-local"
                mono
                value={values.from}
                disabled={byFile}
                invalid={touched && !!errors.from}
                onChange={(e) => onChange({ from: e.target.value })}
              />
            </Field>
          </div>
          <div className="lg:col-span-2">
            <Field label={t('form.to')} error={touched ? errors.to : undefined} htmlFor="calls-to">
              <Input
                id="calls-to"
                type="datetime-local"
                mono
                value={values.to}
                disabled={byFile}
                invalid={touched && !!errors.to}
                onChange={(e) => onChange({ to: e.target.value })}
              />
            </Field>
          </div>
          <div className="flex flex-wrap items-end gap-2 sm:col-span-2 lg:col-span-2">
            <Button type="submit" variant="primary" icon={Search} loading={searching} disabled={searching}>
              {searching ? t('form.searching', { seconds: (elapsed / 1000).toFixed(1) }) : t('form.search')}
            </Button>
            <Button
              type="button"
              variant="ghost"
              icon={RotateCcw}
              onClick={() => {
                setTouched(false)
                onReset()
              }}
            >
              {t('form.reset')}
            </Button>
          </div>
        </form>
      </CardBody>
    </Card>
  )
}
