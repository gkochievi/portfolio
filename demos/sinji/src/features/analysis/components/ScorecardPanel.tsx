import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Ban, Gauge, History, Lock, Pencil, Play, Ruler, Scale } from 'lucide-react'

import { AssayGauge, Hallmark } from '@/components/brand'
import { Badge, Button, Card, EmptyState, Field, Input, Meter, ReadOnlyNote, Skeleton, Spinner, Textarea, toast } from '@/components/ui'
import { errorMessage, fieldError, isApiError } from '@/api/client'
import { cn } from '@/lib/cn'
import { useFormat, formatClock } from '@/lib/format'
import { useGloss } from '@/lib/gloss'
import { computeTotals, scoreBand } from '@/lib/scoring'
import type { SpanLevel, ScoreBands, ScoreDimension } from '@/types'
import { useBands, useEditScores } from '../api'
import { levelMeterTone, levelText } from '../tones'
import { ScoreRevisions } from './ScoreRevisions'
import type { AnalysisPanelProps } from './types'

const NOTE_MAX = 500

type BandKey = 'excellent' | 'good' | 'fair' | 'poor'
const bandKey = (score: number, bands: ScoreBands): BandKey => {
  const level = scoreBand(score, bands)
  if (level === 'good') return score >= Math.max(90, bands.green_from) ? 'excellent' : 'good'
  return level === 'mid' ? 'fair' : 'poor'
}

/** Weighted scorecard with assay gauge, hallmark total, per-dimension bars, in-place edits and revision history. */
export function ScorecardPanel({ recording, onSeek, canEdit }: AnalysisPanelProps) {
  const { t } = useTranslation('analysis')
  const fmt = useFormat()
  const bands = useBands()
  const edit = useEditScores(recording.id)
  const [editing, setEditing] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [draft, setDraft] = useState<Record<string, string>>({})
  const [note, setNote] = useState('')
  const [touched, setTouched] = useState(false)

  const card = recording.scoring
  const running = recording.running.includes('score')

  const parsed = useMemo(() => {
    const out: Record<string, number | null | 'invalid'> = {}
    if (!card) return out
    for (const dim of card.dimensions) {
      const raw = draft[dim.key]
      if (raw === undefined) continue
      if (raw.trim() === '') out[dim.key] = null
      else {
        const n = Number(raw)
        out[dim.key] = Number.isInteger(n) && n >= 0 && n <= dim.max ? n : 'invalid'
      }
    }
    return out
  }, [card, draft])

  const preview = useMemo(() => {
    if (!card || !editing) return null
    const dims = card.dimensions.map((d) => {
      const p = parsed[d.key]
      return p === undefined || p === 'invalid' ? d : { ...d, score: p }
    })
    return computeTotals(dims).weighted_total
  }, [card, editing, parsed])

  if (running && !card) {
    return (
      <Card className="space-y-3" aria-busy>
        <div className="flex items-center gap-2 text-sm text-muted">
          <Spinner size={16} /> {t('score.running')}
        </div>
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-16 w-full" />
      </Card>
    )
  }

  if (!card) {
    return (
      <Card>
        <EmptyState icon={<Gauge className="size-8 text-subtle" aria-hidden />} title={t('score.empty.title')} body={t('score.empty.body')} />
      </Card>
    )
  }

  const total = card.weighted_total
  const level = scoreBand(total, bands) ?? 'mid'
  const modelTotal = recording.revisions[0]?.weighted_total ?? null
  const rows = card.dimensions.filter((d) => d.applicable && d.score !== null && d.weight > 0)
  const excluded = card.dimensions.filter((d) => !(d.applicable && d.score !== null && d.weight > 0))
  const editableKeys = card.dimensions.filter((d) => d.source === 'model' && d.applicable).map((d) => d.key)

  const startEdit = () => {
    setDraft(Object.fromEntries(card.dimensions.filter((d) => editableKeys.includes(d.key)).map((d) => [d.key, d.score === null ? '' : String(d.score)])))
    setNote('')
    setTouched(false)
    edit.reset()
    setEditing(true)
  }
  const cancelEdit = () => {
    setEditing(false)
    edit.reset()
  }

  const changed: Record<string, number> = {}
  for (const key of editableKeys) {
    const p = parsed[key]
    const current = card.dimensions.find((d) => d.key === key)?.score
    if (typeof p === 'number' && p !== current) changed[key] = p
  }
  const hasInvalid = Object.values(parsed).includes('invalid')
  const noteMissing = note.trim().length === 0
  const noteTooLong = note.trim().length > NOTE_MAX
  const nothingChanged = Object.keys(changed).length === 0

  const save = () => {
    setTouched(true)
    if (hasInvalid || noteMissing || noteTooLong || nothingChanged) return
    edit.mutate(
      { scores: changed, note: note.trim() },
      {
        onSuccess: () => {
          toast.success(t('score.edit.saved'))
          setEditing(false)
        },
        onError: (error) => {
          if (!isApiError(error) || Object.keys(error.fieldErrors).length === 0) toast.error(errorMessage(error, t('score.edit.failed')))
        },
      },
    )
  }

  const noteError = touched && noteMissing ? t('score.edit.noteRequired') : noteTooLong ? t('score.edit.noteTooLong', { max: NOTE_MAX }) : fieldError(edit.error, 'note')
  const generalError = fieldError(edit.error, 'scores') ?? (touched && !hasInvalid && !noteMissing && nothingChanged ? t('score.edit.noChange') : undefined)

  return (
    <div className="space-y-4" data-panel="ScorecardPanel">
      {/* Cartouche + gauge ------------------------------------------------ */}
      <Card className="@container relative overflow-hidden">
        <div className="grid items-center justify-items-center gap-5 @2xl:grid-cols-[auto_1fr] @2xl:justify-items-stretch @2xl:gap-6">
          <div className="flex flex-col items-center gap-3">
            <AssayGauge
              key={`${recording.id}-${card.revision}`}
              value={total}
              size={236}
              label={t(`common:bands.${bandKey(total, bands)}`)}
              sublabel={t('score.outOf', { max: card.max_total })}
            />
          </div>
          <div className="min-w-0 space-y-4 self-stretch">
            <div className="flex flex-wrap items-center gap-4">
              <Hallmark
                size="lg"
                value={<span className={levelText[level]}>{total}</span>}
                suffix={`/${card.max_total}`}
                label={t('score.finalScore')}
              />
              <div className="min-w-0 space-y-1.5 text-sm">
                <div className="flex flex-wrap items-center gap-1.5">
                  <Badge tone="neutral" shape="tag">
                    {t('score.revision', { n: card.revision })}
                  </Badge>
                  <Badge tone="neutral" shape="tag" icon={<Scale className="size-3" aria-hidden />}>
                    {t('score.configVersion', { n: card.config_version })}
                  </Badge>
                  {card.manually_edited ? (
                    <Badge tone="accent" icon={<Pencil className="size-3" aria-hidden />}>
                      {t('score.edited')}
                    </Badge>
                  ) : null}
                </div>
                {card.manually_edited && card.edited_by ? (
                  <p className="text-muted">
                    {t('score.editedBy', { name: card.edited_by })}
                    {modelTotal !== null && modelTotal !== total ? <span className="tabular"> · {t('score.modelTotal', { n: modelTotal })}</span> : null}
                  </p>
                ) : (
                  <p className="text-muted">{t('score.byModel')}</p>
                )}
                <p className="text-xs text-subtle">
                  {t('score.scoredAt', { date: fmt.dateTime(card.scored_at) })} · {t('score.weightCounted', { n: card.scored_weight })}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {canEdit && !editing ? (
                <Button size="sm" variant="secondary" icon={<Pencil className="size-3.5" aria-hidden />} onClick={startEdit}>
                  {t('score.edit.button')}
                </Button>
              ) : null}
              <Button size="sm" variant="ghost" icon={<History className="size-3.5" aria-hidden />} onClick={() => setHistoryOpen(true)}>
                {t('score.history.button', { n: recording.revisions.length })}
              </Button>
              <Button size="sm" variant="link" asChild icon={<Ruler className="size-3.5" aria-hidden />}>
                <Link to="/workspace/rubric">{t('score.rubricLink')}</Link>
              </Button>
            </div>
            {!canEdit ? <ReadOnlyNote>{t('score.readOnly')}</ReadOnlyNote> : null}
          </div>
        </div>
      </Card>

      {/* Edit banner ----------------------------------------------------- */}
      {editing ? (
        <Card className="space-y-3 border-accent/40 bg-accent/5" role="form" aria-label={t('score.edit.title')}>
          <div>
            <h3 className="font-display text-lg font-semibold text-ink">{t('score.edit.title')}</h3>
            <p className="text-sm text-muted">{t('score.edit.hint')}</p>
          </div>
          <Field label={t('score.edit.noteLabel')} hint={t('score.edit.noteHint')} error={noteError}>
            <Textarea
              rows={3}
              value={note}
              maxLength={NOTE_MAX + 50}
              placeholder={t('score.edit.notePlaceholder')}
              onChange={(e) => setNote(e.target.value)}
            />
          </Field>
          {generalError ? <p className="text-sm text-danger">{generalError}</p> : null}
          <div className="flex flex-wrap items-center gap-3">
            <Button size="sm" loading={edit.isPending} onClick={save}>
              {t('score.edit.save')}
            </Button>
            <Button size="sm" variant="ghost" onClick={cancelEdit} disabled={edit.isPending}>
              {t('score.edit.cancel')}
            </Button>
            {preview !== null ? (
              <span className="tabular ml-auto text-sm text-muted" aria-live="polite">
                {t('score.edit.preview', { was: total, now: preview })}
              </span>
            ) : null}
          </div>
        </Card>
      ) : null}

      {/* Dimension rows --------------------------------------------------- */}
      <ul className="space-y-3" aria-label={t('score.dimensions')}>
        {(editing ? card.dimensions.filter((d) => editableKeys.includes(d.key) || rows.includes(d)) : rows).map((dim) => (
          <DimensionRow
            key={dim.key}
            dim={dim}
            bands={bands}
            editing={editing && editableKeys.includes(dim.key)}
            lockedInEdit={editing && !editableKeys.includes(dim.key)}
            draftValue={draft[dim.key] ?? ''}
            onDraft={(v) => setDraft((d) => ({ ...d, [dim.key]: v }))}
            error={
              parsed[dim.key] === 'invalid'
                ? t('score.edit.range', { max: dim.max })
                : fieldError(edit.error, `scores.${dim.key}`)
            }
            onSeek={onSeek}
          />
        ))}
      </ul>

      {/* Excluded ---------------------------------------------------------- */}
      {excluded.length > 0 && !editing ? (
        <Card className="space-y-2">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-ink">
            <Ban className="size-4 text-subtle" aria-hidden /> {t('score.excluded.title')}
          </h3>
          <p className="text-xs text-muted">{t('score.excluded.body')}</p>
          <ul className="divide-y divide-line text-sm">
            {excluded.map((d) => (
              <ExcludedRow key={d.key} dim={d} />
            ))}
          </ul>
        </Card>
      ) : null}

      <ScoreRevisions open={historyOpen} onOpenChange={setHistoryOpen} recording={recording} bands={bands} />
    </div>
  )
}

function ExcludedRow({ dim }: { dim: ScoreDimension }) {
  const { t } = useTranslation('analysis')
  const gloss = useGloss()
  const reason = !dim.applicable ? 'notApplicable' : dim.score === null ? 'unscored' : 'noWeight'
  return (
    <li className="flex flex-wrap items-center justify-between gap-2 py-2">
      <span className="min-w-0 text-ink">{gloss.pick(dim.name, dim.name_en)}</span>
      <span className="flex items-center gap-2 text-xs text-muted">
        {dim.source !== 'model' ? <Badge tone="info" shape="tag" size="sm">{t(`score.measured.${dim.source}`)}</Badge> : null}
        <span className="tabular">{t('score.weight', { n: dim.weight })}</span>
        <span>· {t(`score.excluded.reason.${reason}`)}</span>
      </span>
    </li>
  )
}

interface RowProps {
  dim: ScoreDimension
  bands: ScoreBands
  editing: boolean
  lockedInEdit: boolean
  draftValue: string
  onDraft: (value: string) => void
  error?: string
  onSeek: AnalysisPanelProps['onSeek']
}

function DimensionRow({ dim, bands, editing, lockedInEdit, draftValue, onDraft, error, onSeek }: RowProps) {
  const { t } = useTranslation('analysis')
  const gloss = useGloss()
  const level: SpanLevel | null = scoreBand(dim.score, bands)
  const primary = gloss.pick(dim.name, dim.name_en)
  const secondary = gloss.active && dim.name_en && dim.name_en !== dim.name ? dim.name : null
  const measured = dim.source !== 'model'

  return (
    <li>
      <Card className={cn('space-y-3', editing && 'ring-1 ring-accent/50')}>
        <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h4 className="font-medium text-ink">{primary}</h4>
              {measured ? (
                <Badge tone="info" icon={<Ruler className="size-3" aria-hidden />} title={t('score.measuredHint')}>
                  {t(`score.measured.${dim.source}`)}
                </Badge>
              ) : null}
              {dim.edited ? (
                <Badge tone="accent" icon={<Pencil className="size-3" aria-hidden />}>
                  {t('score.editedBadge', { ai: dim.ai_score ?? '-' })}
                </Badge>
              ) : null}
            </div>
            {secondary ? <p className="text-xs text-subtle">{secondary}</p> : null}
            <p className="mt-0.5 text-xs text-muted tabular">
              {t('score.weight', { n: dim.weight })}
              {dim.score !== null ? <> · {t('score.contribution', { n: dim.contribution })}</> : null}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {editing ? (
              <Input
                type="number"
                inputMode="numeric"
                min={0}
                max={dim.max}
                step={1}
                size="sm"
                className="w-20 text-right tabular"
                aria-label={t('score.edit.inputLabel', { name: primary })}
                aria-invalid={!!error}
                value={draftValue}
                placeholder="-"
                onChange={(e) => onDraft(e.target.value)}
              />
            ) : (
              <span className={cn('tabular font-display text-3xl font-semibold leading-none', level ? levelText[level] : 'text-muted')}>
                {dim.score ?? '-'}
              </span>
            )}
            <span className="text-xs text-subtle">/{dim.max}</span>
          </div>
        </div>

        {dim.score !== null && !editing ? <Meter value={dim.score} max={dim.max} tone={levelMeterTone[level ?? 'mid']} label={primary} /> : null}
        {error ? <p className="text-xs text-danger">{error}</p> : null}
        {lockedInEdit ? (
          <p className="flex items-center gap-1.5 text-xs text-muted">
            <Lock className="size-3" aria-hidden /> {t('score.edit.measuredLocked')}
          </p>
        ) : null}

        {dim.rationale ? <p className="text-sm leading-relaxed text-ink/90">{gloss.pick(dim.rationale, dim.rationale_en)}</p> : null}

        {dim.evidence.length > 0 ? (
          <div className="space-y-1.5">
            <p className="caps text-[11px] font-medium text-subtle">{t('score.evidence')}</p>
            <ul className="space-y-1.5">
              {dim.evidence.map((ev, i) => {
                const first = ev.segments[0]
                const timed = ev.start !== null
                return (
                  <li key={i}>
                    <button
                      type="button"
                      onClick={() => onSeek(ev.start, first)}
                      className="group flex w-full items-start gap-2 rounded-ctl border border-line bg-sunken px-2.5 py-1.5 text-left text-sm transition-colors hover:border-accent/60 hover:bg-accent/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                      aria-label={timed ? t('score.seekTo', { time: formatClock(ev.start) }) : t('score.goToLine', { n: (first ?? 0) + 1 })}
                    >
                      <span className="tabular mt-0.5 inline-flex shrink-0 items-center gap-1 font-mono text-[11px] text-accent">
                        <Play className="size-3" aria-hidden />
                        {timed ? formatClock(ev.start) : t('score.line', { n: (first ?? 0) + 1 })}
                      </span>
                      <span className="min-w-0 text-ink/90">&ldquo;{gloss.pick(ev.quote, ev.quote_en)}&rdquo;</span>
                    </button>
                  </li>
                )
              })}
            </ul>
          </div>
        ) : null}
      </Card>
    </li>
  )
}
