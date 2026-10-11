/**
 * The rubric editor, used twice: the workspace rubric (RubricPage) and the
 * operator's global default (DefaultRubricPage). It owns an editable copy of the
 * dimensions; the parent supplies the saved version and the save call.
 * OWNED BY: workspace-settings.
 */
import { Check, Lock, Plus, Scale, Trash2, X } from 'lucide-react'
import { useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Badge, Button, Callout, Field, IconButton, Input, Panel, Textarea } from '@/components/ui'
import { ApiError } from '@/lib/api'
import { cn } from '@/lib/cn'
import { useGloss } from '@/lib/gloss'
import { isMeasured, normaliseWeights, validateRubric, weightSum, type RubricError } from '@/lib/scoring'
import type { RubricDimension } from '@/types'
import type { RubricDraft } from '../api'

type Row = RubricDimension & { uid: string }

export interface IncomingDraft extends RubricDraft {
  /** Changes whenever a new draft arrives (AI import), so the editor reloads. */
  id: string
  filename?: string
}

export interface RubricEditorProps {
  initial: RubricDraft
  incoming?: IncomingDraft | null
  readOnly: boolean
  saving?: boolean
  /** Save the dimensions + free text; throw to keep the editor open. */
  onSave: (draft: RubricDraft) => Promise<unknown>
  /** Called when the person throws away an imported draft. */
  onDiscardIncoming?: () => void
  /** Adds a "Validate" button (the operator default page). */
  allowValidate?: boolean
  /** Rendered above the dimension list (e.g. the AI import button row). */
  toolbar?: React.ReactNode
}

let counter = 0
const nextUid = () => `row_${(counter += 1)}`
const toRows = (dims: readonly RubricDimension[]): Row[] => dims.map((d) => ({ ...d, uid: nextUid() }))
const stripUid = (rows: readonly Row[]): RubricDimension[] => rows.map(({ uid: _uid, ...d }) => d)

export function SumBadge({ sum }: { sum: number }) {
  const { t } = useTranslation('settings')
  const ok = sum === 100
  const shown = Math.round(sum * 10) / 10
  return (
    <Badge tone={ok ? 'success' : 'danger'} icon={ok ? <Check /> : <X />} className="tabular" aria-live="polite">
      {ok ? t('rubric.sum.ok', { sum: shown }) : t('rubric.sum.bad', { sum: shown })}
    </Badge>
  )
}

export default function RubricEditor({
  initial,
  incoming,
  readOnly,
  saving,
  onSave,
  onDiscardIncoming,
  allowValidate,
  toolbar,
}: RubricEditorProps) {
  const { t } = useTranslation('settings')
  const gloss = useGloss()
  const [rows, setRows] = useState<Row[]>(() => toRows(incoming?.dimensions ?? initial.dimensions))
  const [text, setText] = useState(incoming?.rubric ?? initial.rubric)
  const [draftFrom, setDraftFrom] = useState<string | null>(incoming?.id ?? null)
  const [draftName, setDraftName] = useState<string | undefined>(incoming?.filename)
  const [showErrors, setShowErrors] = useState(false)
  const [validated, setValidated] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)

  // A newly imported draft replaces the working copy (adjusting state during render, not in an effect).
  if (incoming && incoming.id !== draftFrom) {
    setDraftFrom(incoming.id)
    setDraftName(incoming.filename)
    setRows(toRows(incoming.dimensions))
    setText(incoming.rubric)
    setShowErrors(false)
    setValidated(false)
    setServerError(null)
  }

  const clean = useMemo(() => stripUid(rows), [rows])
  const errors: RubricError[] = useMemo(() => validateRubric(clean), [clean])
  const sum = weightSum(clean)
  const isDraft = Boolean(incoming)
  const dirty = isDraft || text !== initial.rubric || JSON.stringify(clean) !== JSON.stringify(initial.dimensions)
  const footerRef = useRef<HTMLDivElement>(null)

  const patch = (uid: string, change: Partial<RubricDimension>) => {
    setRows((current) => current.map((r) => (r.uid === uid ? { ...r, ...change } : r)))
    setValidated(false)
  }

  const add = () => {
    setRows((current) => [
      ...current,
      { uid: nextUid(), key: `custom_${current.length + 1}_${Math.random().toString(36).slice(2, 6)}`, name: '', description: '', guidance: '', weight: 0, source: 'model' },
    ])
    setValidated(false)
  }

  const remove = (uid: string) => {
    setRows((current) => current.filter((r) => r.uid !== uid))
    setValidated(false)
  }

  const discard = () => {
    setRows(toRows(initial.dimensions))
    setText(initial.rubric)
    setShowErrors(false)
    setValidated(false)
    setServerError(null)
    setDraftFrom(null)
    onDiscardIncoming?.()
  }

  const validate = () => {
    setShowErrors(true)
    setValidated(errors.length === 0)
  }

  const save = async () => {
    setShowErrors(true)
    setServerError(null)
    if (errors.length > 0) {
      footerRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
      return
    }
    try {
      await onSave({ dimensions: clean, rubric: text })
      setShowErrors(false)
      setDraftFrom(null)
    } catch (error) {
      if (error instanceof ApiError && error.fieldErrors.dimensions?.length) {
        setServerError(error.fieldErrors.dimensions.map((code) => t(`rubric.errors.${code}`, { defaultValue: code })).join(' '))
      } else setServerError(error instanceof ApiError ? error.message : t('rubric.saveFailed'))
    }
  }

  return (
    <div className="space-y-4">
      {isDraft ? (
        <Callout
          tone="info"
          title={draftName ? t('rubric.draft.titleFile', { file: draftName }) : t('rubric.draft.title')}
          action={
            readOnly ? undefined : (
              <Button size="sm" variant="secondary" onClick={discard}>
                {t('rubric.draft.discard')}
              </Button>
            )
          }
        >
          {t('rubric.draft.body')}
        </Callout>
      ) : null}

      <Panel
        title={t('rubric.dimensions.title')}
        description={t('rubric.dimensions.description')}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <SumBadge sum={sum} />
            {readOnly ? null : (
              <Button size="sm" variant="secondary" icon={<Scale />} onClick={() => setRows((r) => normaliseWeights(r))} disabled={rows.length === 0}>
                {t('rubric.normalise')}
              </Button>
            )}
          </div>
        }
      >
        {toolbar ? <div className="mb-4">{toolbar}</div> : null}
        <ol className="space-y-3">
          {rows.map((row, index) => {
            const measured = isMeasured(row)
            const label = gloss.pick(row.name, row.name_en) || t('rubric.unnamed')
            return (
              <li key={row.uid} className={cn('rounded-card border border-line p-3 sm:p-4', measured ? 'bg-sunken' : 'bg-panel')}>
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  <span className="tabular grid size-6 place-items-center rounded-pill bg-ink/7 text-xs font-medium text-muted">{index + 1}</span>
                  {measured ? (
                    <Badge tone="accent" icon={<Lock />}>
                      {t(row.source === 'factcheck' ? 'rubric.measured.factcheck' : 'rubric.measured.sentiment')}
                    </Badge>
                  ) : null}
                  <span className="min-w-0 flex-1 truncate text-sm font-medium">{label}</span>
                  {!measured && !readOnly ? (
                    <IconButton label={t('rubric.dimensions.remove', { name: label })} icon={<Trash2 />} variant="ghost" size="sm" onClick={() => remove(row.uid)} />
                  ) : null}
                </div>

                {measured ? (
                  <div className="grid gap-3 sm:grid-cols-[1fr_140px]">
                    <div className="space-y-1.5 text-[13px]">
                      <p>{gloss.pick(row.description, row.description_en)}</p>
                      <p className="text-xs text-muted">{t('rubric.measured.note')}</p>
                    </div>
                    <WeightField row={row} readOnly={readOnly} onChange={(weight) => patch(row.uid, { weight })} />
                  </div>
                ) : (
                  <div className="grid gap-3">
                    <div className="grid gap-3 sm:grid-cols-[1fr_1fr_140px]">
                      <Field label={t('rubric.field.name')}>
                        <Input value={row.name} disabled={readOnly} onChange={(e) => patch(row.uid, { name: e.target.value })} maxLength={120} />
                      </Field>
                      <Field label={t('rubric.field.nameEn')} optional>
                        <Input
                          value={row.name_en ?? ''}
                          disabled={readOnly}
                          onChange={(e) => {
                            const value = e.target.value
                            setRows((current) =>
                              current.map((r) => {
                                if (r.uid !== row.uid) return r
                                const { name_en: _old, ...others } = r
                                return value ? { ...others, name_en: value } : others
                              }),
                            )
                          }}
                          maxLength={120}
                        />
                      </Field>
                      <WeightField row={row} readOnly={readOnly} onChange={(weight) => patch(row.uid, { weight })} />
                    </div>
                    <div className="grid gap-3 md:grid-cols-2">
                      <Field label={t('rubric.field.description')} hint={t('rubric.field.descriptionHint')}>
                        <Textarea rows={3} value={row.description} disabled={readOnly} onChange={(e) => patch(row.uid, { description: e.target.value })} />
                      </Field>
                      <Field label={t('rubric.field.guidance')} hint={t('rubric.field.guidanceHint')}>
                        <Textarea rows={3} value={row.guidance} disabled={readOnly} onChange={(e) => patch(row.uid, { guidance: e.target.value })} />
                      </Field>
                    </div>
                  </div>
                )}
              </li>
            )
          })}
        </ol>
        {rows.length === 0 ? <p className="rounded-card border border-dashed border-line-strong p-6 text-center text-sm text-muted">{t('rubric.dimensions.none')}</p> : null}
        {readOnly ? null : (
          <Button className="mt-3" variant="secondary" icon={<Plus />} onClick={add}>
            {t('rubric.dimensions.add')}
          </Button>
        )}
      </Panel>

      <Panel title={t('rubric.text.title')} description={t('rubric.text.description')}>
        <Field label={t('rubric.text.label')} hint={t('rubric.text.hint')}>
          <Textarea
            rows={7}
            value={text}
            disabled={readOnly}
            placeholder={t('rubric.text.placeholder')}
            onChange={(e) => {
              setText(e.target.value)
              setValidated(false)
            }}
          />
        </Field>
      </Panel>

      {readOnly ? null : (
        <div ref={footerRef} className="sticky bottom-3 z-10 space-y-3 rounded-card border border-line-strong bg-panel/95 p-3 shadow-pop backdrop-blur sm:p-4">
          {showErrors && errors.length > 0 ? (
            <Callout tone="danger" title={t('rubric.errors.title')}>
              <ul className="list-disc space-y-0.5 pl-5">
                {errors.map((code) => (
                  <li key={code}>{t(`rubric.errors.${code}`, { sum: Math.round(sum * 10) / 10 })}</li>
                ))}
              </ul>
            </Callout>
          ) : null}
          {validated ? <Callout tone="success">{t('rubric.validate.ok')}</Callout> : null}
          {serverError ? <Callout tone="danger">{serverError}</Callout> : null}
          <div className="flex flex-wrap items-center gap-2">
            <SumBadge sum={sum} />
            <span className="flex-1" />
            {dirty ? (
              <Button variant="ghost" onClick={discard} disabled={saving}>
                {t('rubric.discard')}
              </Button>
            ) : null}
            {allowValidate ? (
              <Button variant="secondary" onClick={validate} disabled={saving}>
                {t('rubric.validate.button')}
              </Button>
            ) : null}
            <Button variant="primary" loading={saving} disabled={!dirty} onClick={() => void save()} className="min-w-28">
              {t('rubric.save')}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

function WeightField({ row, readOnly, onChange }: { row: Row; readOnly: boolean; onChange: (weight: number) => void }) {
  const { t } = useTranslation('settings')
  return (
    <Field label={t('rubric.field.weight')}>
      <Input
        type="number"
        inputMode="decimal"
        min={0}
        max={100}
        step={1}
        className="tabular"
        value={Number.isFinite(row.weight) ? row.weight : 0}
        disabled={readOnly}
        trailing={<span className="text-xs text-muted">%</span>}
        onChange={(e) => onChange(e.target.value === '' ? 0 : Number(e.target.value))}
      />
    </Field>
  )
}
