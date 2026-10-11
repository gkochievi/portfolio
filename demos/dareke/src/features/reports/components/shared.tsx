/** Small pieces shared by the reports and call-history screens. */
import { Mic } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Badge, DateInput, Field } from '@/components/ui'
import { toDateInput } from '@/lib/format'
import { useLocalized } from '@/lib/localized'
import type { CallOutcome, CallRecordView, Tone } from '@/types'

import type { DateRange } from '../types'

/* ------------------------------------------------------------ date ranges */

export interface DateInputs {
  from: string
  to: string
}

/** The last `days` days ending today, as `<input type=date>` values. */
export function lastDays(days: number): DateInputs {
  const now = new Date()
  const start = new Date(now)
  start.setDate(now.getDate() - (days - 1))
  return { from: toDateInput(start), to: toDateInput(now) }
}

/** yyyy-mm-dd -> local day bounds as ISO. Returns an error key when invalid. */
export function toRange(inputs: DateInputs): { range: DateRange } | { error: { field: 'from' | 'to'; key: string } } {
  if (!inputs.from) return { error: { field: 'from', key: 'validation.fromRequired' } }
  if (!inputs.to) return { error: { field: 'to', key: 'validation.toRequired' } }
  const from = new Date(`${inputs.from}T00:00:00`)
  const to = new Date(`${inputs.to}T23:59:59.999`)
  if (Number.isNaN(from.getTime())) return { error: { field: 'from', key: 'validation.invalidDate' } }
  if (Number.isNaN(to.getTime())) return { error: { field: 'to', key: 'validation.invalidDate' } }
  if (from > to) return { error: { field: 'to', key: 'validation.toBeforeFrom' } }
  if (to.getTime() - from.getTime() > 366 * 864e5) return { error: { field: 'from', key: 'validation.tooLong' } }
  return { range: { from: from.toISOString(), to: to.toISOString() } }
}

/** YYYY-MM-DD for export filenames. */
export const fileStamp = () => toDateInput(new Date())

export function DateRangeFields({
  value,
  onChange,
  errors,
}: {
  value: DateInputs
  onChange: (next: DateInputs) => void
  errors?: Partial<Record<'from' | 'to', string>>
}) {
  const { t } = useTranslation('reports')
  return (
    <>
      <Field label={t('filters.from')} error={errors?.from} className="w-full sm:w-44">
        <DateInput value={value.from} max={value.to || undefined} invalid={!!errors?.from} onChange={(e) => onChange({ ...value, from: e.target.value })} />
      </Field>
      <Field label={t('filters.to')} error={errors?.to} className="w-full sm:w-44">
        <DateInput value={value.to} min={value.from || undefined} invalid={!!errors?.to} onChange={(e) => onChange({ ...value, to: e.target.value })} />
      </Field>
    </>
  )
}

/* ---------------------------------------------------------------- badges */

export function DispositionBadge({ call }: { call: Pick<CallRecordView, 'dispositionCode' | 'dispositionName' | 'dispositionColor'> }) {
  const l = useLocalized()
  const { t } = useTranslation('reports')
  if (!call.dispositionCode) return <span className="text-xs text-muted">{t('table.noDisposition')}</span>
  return <Badge tone={call.dispositionColor ?? 'muted'}>{l(call.dispositionName) || call.dispositionCode}</Badge>
}

const OUTCOME_TONE: Record<CallOutcome, Tone> = {
  IN_PROGRESS: 'lime',
  ANSWERED: 'success',
  NO_ANSWER: 'warning',
  BUSY: 'warning',
  FAILED: 'danger',
  ABANDONED: 'muted',
}

export function OutcomeBadge({ outcome }: { outcome: CallOutcome }) {
  const { t } = useTranslation()
  return (
    <Badge tone={OUTCOME_TONE[outcome]} variant="outline">
      {t(`callOutcome.${outcome}`)}
    </Badge>
  )
}

export function NoRecording() {
  const { t } = useTranslation('reports')
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-muted">
      <Mic size={14} strokeWidth={1.75} aria-hidden />
      {t('recording.none')}
    </span>
  )
}
