import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { AudioLines, FileText, Mic, MicOff, Pencil, ShieldAlert, TriangleAlert, Waves } from 'lucide-react'

import {
  Badge,
  Button,
  Callout,
  Card,
  EmptyState,
  Field,
  FilterChip,
  Meter,
  ReadOnlyNote,
  Skeleton,
  Spinner,
  StatusChip,
  Switch,
  Textarea,
  toast,
} from '@/components/ui'
import { errorMessage, fieldError } from '@/api/client'
import { cn } from '@/lib/cn'
import { formatClock, useFormat } from '@/lib/format'
import { useGloss } from '@/lib/gloss'
import { spanLevel } from '@/lib/scoring'
import type { Agreement, Recording, SpeakerTone } from '@/types'
import { useSaveSentiment, useSentimentConfig } from '../api'
import { levelBorder, levelMeterTone, textToneBadge, toPercent, voiceBadge, worstLevel } from '../tones'
import type { AnalysisPanelProps } from './types'

type Mode = 'words' | 'voice'
const GUIDANCE_MAX = 2000
const FLAG_FALLBACK = (flag: string) => flag.replace(/_/g, ' ')

/** Per-speaker politeness, per-line tone, voice emotion, text-vs-voice agreement / conflict. */
export function TonePanel({ recording, onSeek, canEdit }: AnalysisPanelProps) {
  const { t } = useTranslation('analysis')
  const gloss = useGloss()
  const sem = recording.semantic
  const [modes, setModes] = useState<Record<Mode, boolean>>({ words: true, voice: true })
  const [simulateOff, setSimulateOff] = useState(false)
  const [flaggedOnly, setFlaggedOnly] = useState<boolean | null>(null)

  const isAudio = recording.source === 'audio'
  const voiceOn = !!sem && sem.voice_available && isAudio && !simulateOff
  const wordsOn = modes.words || !voiceOn
  const showVoice = voiceOn && modes.voice

  const lines = useMemo(() => {
    if (!sem) return []
    const roleOf = new Map(sem.speakers.map((s) => [s.speaker, s.role]))
    return sem.segments.map((tone) => {
      const seg = recording.segments.find((s) => s.i === tone.i)
      return { tone, seg, role: seg ? roleOf.get(seg.speaker) ?? 'customer' : 'customer' }
    })
  }, [sem, recording.segments])

  if (recording.running.includes('semantic') && !sem) {
    return (
      <Card className="space-y-3" aria-busy>
        <div className="flex items-center gap-2 text-sm text-muted">
          <Spinner size={16} /> {t('tone.running')}
        </div>
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-32 w-full" />
      </Card>
    )
  }

  if (!sem) {
    return (
      <div className="space-y-4" data-panel="TonePanel">
        <Card>
          <EmptyState icon={<Waves className="size-8 text-subtle" aria-hidden />} title={t('tone.empty.title')} body={t('tone.empty.body')} />
        </Card>
        <GuidancePanel canEdit={canEdit} />
      </div>
    )
  }

  const flaggedCount = lines.filter(({ tone }) => isFlagged(tone, wordsOn, showVoice)).length
  const onlyFlagged = flaggedOnly ?? (flaggedCount > 0 && lines.length > 14)
  const visible = onlyFlagged ? lines.filter(({ tone }) => isFlagged(tone, wordsOn, showVoice)) : lines

  const toggleMode = (mode: Mode) => {
    const next = { ...modes, [mode]: !modes[mode] }
    if (!next.words && !next.voice) return
    setModes(next)
  }

  return (
    <div className="space-y-4" data-panel="TonePanel">
      <AgreementBanner recording={recording} voiceOn={voiceOn} simulated={simulateOff} />

      {/* Controls ----------------------------------------------------------- */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2" role="group" aria-label={t('tone.modes.label')}>
          <FilterChip active={wordsOn} onClick={() => (voiceOn ? toggleMode('words') : undefined)} icon={<FileText className="size-3.5" aria-hidden />}>
            {t('tone.modes.words')}
          </FilterChip>
          {voiceOn ? (
            <FilterChip active={modes.voice} onClick={() => toggleMode('voice')} icon={<Mic className="size-3.5" aria-hidden />}>
              {t('tone.modes.voice')}
            </FilterChip>
          ) : (
            <span className="inline-flex items-center gap-1.5 rounded-pill border border-dashed border-line px-2.5 py-1 text-xs text-subtle">
              <MicOff className="size-3.5" aria-hidden /> {t('tone.modes.voiceOff')}
            </span>
          )}
        </div>
        {isAudio && sem.voice_available ? (
          <Switch
            size="sm"
            checked={simulateOff}
            onCheckedChange={setSimulateOff}
            label={t('tone.simulate.label')}
            description={t('tone.simulate.hint')}
          />
        ) : null}
      </div>

      {/* Speakers ------------------------------------------------------------ */}
      <div className="grid gap-3 md:grid-cols-2">
        {sem.speakers.map((sp) => (
          <SpeakerCard key={sp.speaker} sp={sp} wordsOn={wordsOn} showVoice={showVoice} />
        ))}
      </div>

      {sem.summary ? (
        <Card className="space-y-1">
          <h3 className="caps text-[11px] font-medium text-subtle">{t('tone.summary')}</h3>
          <p className="text-sm leading-relaxed text-ink/90">{gloss.pick(sem.summary, sem.summary_en)}</p>
        </Card>
      ) : null}

      {/* Per-line ------------------------------------------------------------ */}
      <Card className="space-y-3 !p-0">
        <div className="flex flex-wrap items-center justify-between gap-2 px-4 pt-4">
          <div>
            <h3 className="font-display text-lg font-semibold text-ink">{t('tone.lines.title')}</h3>
            <p className="text-xs text-muted">{t('tone.lines.hint')}</p>
          </div>
          <div className="flex items-center gap-2">
            <FilterChip active={!onlyFlagged} onClick={() => setFlaggedOnly(false)} count={lines.length}>
              {t('tone.lines.all')}
            </FilterChip>
            <FilterChip active={onlyFlagged} onClick={() => setFlaggedOnly(true)} count={flaggedCount}>
              {t('tone.lines.flagged')}
            </FilterChip>
          </div>
        </div>
        {visible.length === 0 ? (
          <p className="px-4 pb-4 text-sm text-muted">{t('tone.lines.none')}</p>
        ) : (
          <ul className="max-h-[560px] divide-y divide-line overflow-y-auto border-t border-line">
            {visible.map(({ tone, seg, role }) => {
              const level = worstLevel(wordsOn ? tone.text_level : null, showVoice ? tone.voice_level : null)
              const clash = wordsOn && showVoice && tone.text_level === 'good' && tone.voice_level === 'bad'
              const text = seg ? gloss.pick(seg.text, seg.text_en) : ''
              const note = tone.text_note ? gloss.pick(tone.text_note, tone.text_note_en) : null
              return (
                <li key={tone.i}>
                  <button
                    type="button"
                    onClick={() => onSeek(seg?.start ?? null, tone.i)}
                    className={cn(
                      'flex w-full flex-col gap-1.5 border-l-4 px-4 py-2.5 text-left transition-colors hover:bg-sunken focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary',
                      levelBorder[level],
                    )}
                    aria-label={seg?.start != null ? t('tone.lines.seek', { time: formatClock(seg.start) }) : t('tone.lines.goTo', { n: tone.i + 1 })}
                  >
                    <span className="flex flex-wrap items-center gap-1.5 text-xs">
                      <span className="tabular font-mono text-accent">{seg?.start != null ? formatClock(seg.start) : `#${tone.i + 1}`}</span>
                      <span className="text-muted">{t(`common:speakers.${role}`)}</span>
                      {wordsOn ? (
                        <Badge tone={textToneBadge[tone.text_tone]} size="sm">
                          {t(`tone.text.${tone.text_tone}`)}
                        </Badge>
                      ) : null}
                      {showVoice && tone.voice_label ? (
                        <Badge tone={voiceBadge[tone.voice_label]} size="sm" outline icon={<AudioLines className="size-3" aria-hidden />}>
                          {t(`tone.voice.${tone.voice_label}`)}
                          {tone.voice_confidence !== null ? <span className="tabular opacity-70"> {toPercent(tone.voice_confidence)}%</span> : null}
                        </Badge>
                      ) : null}
                      {clash ? (
                        <Badge tone="warning" size="sm" icon={<TriangleAlert className="size-3" aria-hidden />}>
                          {t('tone.lines.clash')}
                        </Badge>
                      ) : null}
                    </span>
                    {text ? <span className="line-clamp-2 text-sm text-ink/90">{text}</span> : null}
                    {note && wordsOn ? <span className="text-xs italic text-muted">{note}</span> : null}
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </Card>

      <GuidancePanel canEdit={canEdit} />
    </div>
  )
}

function isFlagged(tone: { text_level: string; voice_level: string | null; text_note: string | null }, wordsOn: boolean, voiceOn: boolean) {
  return (wordsOn && (tone.text_level !== 'good' || !!tone.text_note)) || (voiceOn && !!tone.voice_level && tone.voice_level !== 'good')
}

/* ------------------------------------------------------------------ banner */

const bannerTone: Record<Agreement, 'success' | 'info' | 'warning' | 'danger'> = {
  agree: 'success',
  partial: 'info',
  conflict: 'danger',
  text_only: 'info',
  prosody_only: 'info',
  unknown: 'info',
}

function AgreementBanner({ recording, voiceOn, simulated }: { recording: Recording; voiceOn: boolean; simulated: boolean }) {
  const { t } = useTranslation('analysis')
  const sem = recording.semantic
  const sent = recording.sentiment
  if (!sem) return null

  const agreement: Agreement = voiceOn ? sent?.agreement ?? 'unknown' : 'text_only'
  const textLabel = sent?.text ? t(`common:tones.${sent.text.label}`) : '-'
  const voiceLabel = sent?.prosody ? t(`tone.voice.${sent.prosody.label}`) : '-'
  const overall = sent ? t(`common:tones.${sent.overall}`) : '-'

  let reason = ''
  if (agreement === 'text_only') {
    reason = simulated
      ? t('tone.noVoice.simulated')
      : recording.source === 'text'
        ? t('tone.noVoice.textSource')
        : t(`tone.noVoice.status.${sem.voice_status}`)
  }

  const Icon = agreement === 'conflict' ? ShieldAlert : agreement === 'text_only' ? MicOff : AudioLines

  return (
    <div className="space-y-3">
      <Callout
        tone={bannerTone[agreement]}
        icon={<Icon className="size-4" aria-hidden />}
        title={t(`tone.agreement.${agreement}.title`)}
        className={agreement === 'conflict' ? 'ring-1 ring-danger/30' : undefined}
      >
        <p>
          {agreement === 'text_only'
            ? reason
            : t(`tone.agreement.${agreement}.body`, { text: textLabel, voice: voiceLabel, overall })}
        </p>
        {agreement === 'text_only' && recording.source === 'audio' && !simulated && sem.voice_status !== 'ok' ? (
          <p className="mt-1 text-xs opacity-80">{t('tone.noVoice.hint')}</p>
        ) : null}
      </Callout>

      {sent && (sent.text || (voiceOn && sent.prosody)) ? (
        <div className="grid gap-3 md:grid-cols-2">
          <Card className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <h4 className="flex items-center gap-1.5 text-sm font-semibold text-ink">
                <FileText className="size-4 text-subtle" aria-hidden /> {t('tone.sides.words')}
              </h4>
              {sent.text ? <Badge tone={polarityTone(sent.text.polarity)}>{textLabel}</Badge> : null}
            </div>
            {sent.text ? (
              <>
                <PolarityScale value={sent.text.polarity} label={t('tone.sides.polarity')} />
                <p className="text-sm text-ink/90">{sent.text.rationale}</p>
              </>
            ) : (
              <p className="text-sm text-muted">{t('tone.sides.noWords')}</p>
            )}
          </Card>
          <Card className={cn('space-y-2', agreement === 'conflict' && 'border-danger/40')}>
            <div className="flex items-center justify-between gap-2">
              <h4 className="flex items-center gap-1.5 text-sm font-semibold text-ink">
                <Mic className="size-4 text-subtle" aria-hidden /> {t('tone.sides.voice')}
                {agreement === 'conflict' ? <Badge tone="danger" size="sm">{t('tone.sides.leads')}</Badge> : null}
              </h4>
              {voiceOn && sent.prosody ? <Badge tone={polarityTone(sent.prosody.polarity)}>{voiceLabel}</Badge> : null}
            </div>
            {voiceOn && sent.prosody ? (
              <>
                <PolarityScale value={sent.prosody.polarity} label={t('tone.sides.polarity')} />
                <dl className="grid grid-cols-3 gap-2 text-xs">
                  {(['arousal', 'valence', 'dominance'] as const).map((k) => (
                    <div key={k} className="space-y-1">
                      <dt className="text-muted">{t(`tone.sides.${k}`)}</dt>
                      <dd>
                        <Meter value={toPercent(sent.prosody![k])} ticks={10} tone={k === 'valence' ? 'success' : 'primary'} label={t(`tone.sides.${k}`)} />
                      </dd>
                    </div>
                  ))}
                </dl>
                <p className="text-xs text-muted tabular">{t('tone.sides.confidence', { n: toPercent(sent.prosody.confidence) })}</p>
              </>
            ) : (
              <p className="text-sm text-muted">{t('tone.sides.noVoice')}</p>
            )}
          </Card>
        </div>
      ) : null}
      {sent && agreement === 'conflict' ? (
        <p className="text-xs text-muted">{t('tone.neverAveraged')}</p>
      ) : null}
    </div>
  )
}

const polarityTone = (p: number): 'success' | 'neutral' | 'danger' => (p > 0.15 ? 'success' : p < -0.15 ? 'danger' : 'neutral')

function PolarityScale({ value, label }: { value: number; label: string }) {
  const pos = Math.max(0, Math.min(1, (value + 1) / 2)) * 100
  return (
    <div className="space-y-1" role="img" aria-label={`${label}: ${value.toFixed(2)}`}>
      <div className="relative h-2 rounded-pill bg-gradient-to-r from-danger/25 via-ink/10 to-success/25">
        <span className="absolute inset-y-[-2px] left-1/2 w-px bg-ink/30" />
        <span className="absolute top-1/2 size-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-panel bg-accent" style={{ left: `${pos}%` }} />
      </div>
      <div className="flex justify-between text-[10px] tabular text-subtle">
        <span>-1</span>
        <span>{value > 0 ? '+' : ''}{value.toFixed(2)}</span>
        <span>+1</span>
      </div>
    </div>
  )
}

/* ---------------------------------------------------------------- speakers */

function SpeakerCard({ sp, wordsOn, showVoice }: { sp: SpeakerTone; wordsOn: boolean; showVoice: boolean }) {
  const { t } = useTranslation('analysis')
  const level = spanLevel(sp.text.politeness)
  return (
    <Card className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h4 className="font-display text-lg font-semibold text-ink">{t(`common:speakers.${sp.role}`)}</h4>
        {wordsOn ? (
          <Badge tone={textToneBadge[sp.text.overall]}>{t(`tone.text.${sp.text.overall}`)}</Badge>
        ) : null}
      </div>
      {wordsOn ? (
        <>
          <div className="space-y-1">
            <div className="flex items-baseline justify-between text-xs text-muted">
              <span>{t('tone.speaker.politeness')}</span>
              <span className="tabular font-display text-2xl font-semibold text-ink">{sp.text.politeness}</span>
            </div>
            <Meter value={sp.text.politeness} tone={levelMeterTone[level]} label={t('tone.speaker.politeness')} />
          </div>
          {sp.text.flags.length > 0 ? (
            <div className="flex flex-wrap gap-1.5" aria-label={t('tone.speaker.flags')}>
              {sp.text.flags.map((flag) => (
                <Badge key={flag} tone="warning" shape="tag" size="sm">
                  {t(`tone.flags.${flag}`, { defaultValue: FLAG_FALLBACK(flag) })}
                </Badge>
              ))}
            </div>
          ) : (
            <p className="text-xs text-subtle">{t('tone.speaker.noFlags')}</p>
          )}
          <p className="text-sm leading-relaxed text-ink/90">{sp.text.rationale}</p>
        </>
      ) : null}
      {showVoice && sp.voice ? (
        <div className={cn('space-y-2 rounded-ctl bg-sunken p-3', wordsOn && 'mt-1')}>
          <div className="flex items-center justify-between gap-2 text-xs text-muted">
            <span className="flex items-center gap-1.5">
              <Mic className="size-3.5" aria-hidden /> {t('tone.speaker.voice')}
            </span>
            <Badge tone={voiceBadge[sp.voice.voice]} size="sm">
              {t(`tone.voice.${sp.voice.voice}`)}
            </Badge>
          </div>
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="space-y-1">
              <div className="flex justify-between text-muted">
                <span>{t('tone.speaker.shareBad')}</span>
                <span className="tabular text-ink">{toPercent(sp.voice.share_bad)}%</span>
              </div>
              <Meter value={toPercent(sp.voice.share_bad)} ticks={10} tone="danger" label={t('tone.speaker.shareBad')} />
            </div>
            <div className="space-y-1">
              <div className="flex justify-between text-muted">
                <span>{t('tone.speaker.shareGood')}</span>
                <span className="tabular text-ink">{toPercent(sp.voice.share_good)}%</span>
              </div>
              <Meter value={toPercent(sp.voice.share_good)} ticks={10} tone="success" label={t('tone.speaker.shareGood')} />
            </div>
          </div>
        </div>
      ) : null}
    </Card>
  )
}

/* ---------------------------------------------------------------- guidance */

function GuidancePanel({ canEdit }: { canEdit: boolean }) {
  const { t } = useTranslation('analysis')
  const fmt = useFormat()
  const query = useSentimentConfig()
  const save = useSaveSentiment()
  const [editing, setEditing] = useState(false)
  const [text, setText] = useState('')
  const [enabled, setEnabled] = useState(true)
  const cfg = query.data

  const statusTone = cfg?.voice_tone === 'ok' ? 'success' : cfg?.voice_tone === 'warming' ? 'warning' : cfg?.voice_tone === 'disabled' ? 'neutral' : 'danger'
  const tooLong = text.length > GUIDANCE_MAX

  const onSave = () => {
    if (tooLong) return
    save.mutate(
      { enabled, guidance: text.trim() },
      {
        onSuccess: () => {
          toast.success(t('tone.guidance.saved'))
          setEditing(false)
        },
        onError: (e) => toast.error(errorMessage(e, t('tone.guidance.failed'))),
      },
    )
  }

  return (
    <Card className="space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="font-display text-lg font-semibold text-ink">{t('tone.guidance.title')}</h3>
          <p className="text-xs text-muted">{t('tone.guidance.hint')}</p>
        </div>
        {cfg ? (
          <div className="flex flex-wrap items-center gap-1.5">
            <StatusChip tone={cfg.enabled ? 'success' : 'neutral'}>{cfg.enabled ? t('tone.guidance.enabled') : t('tone.guidance.disabled')}</StatusChip>
            <StatusChip tone={statusTone} pulse={cfg.voice_tone === 'warming'}>
              {t(`tone.voiceStatus.${cfg.voice_tone}`)}
            </StatusChip>
          </div>
        ) : null}
      </div>

      {query.isPending ? (
        <Skeleton className="h-16 w-full" />
      ) : query.isError || !cfg ? (
        <p className="text-sm text-danger">
          {t('tone.guidance.error')}{' '}
          <Button size="xs" variant="link" onClick={() => void query.refetch()}>
            {t('common:actions.retry')}
          </Button>
        </p>
      ) : editing ? (
        <div className="space-y-3">
          <Switch checked={enabled} onCheckedChange={setEnabled} label={t('tone.guidance.enableLabel')} description={t('tone.guidance.enableHint')} />
          <Field label={t('tone.guidance.label')} error={tooLong ? t('tone.guidance.tooLong', { max: GUIDANCE_MAX }) : fieldError(save.error, 'guidance')} hint={t('tone.guidance.count', { n: text.length, max: GUIDANCE_MAX })}>
            <Textarea rows={5} value={text} onChange={(e) => setText(e.target.value)} placeholder={t('tone.guidance.placeholder')} />
          </Field>
          <div className="flex gap-2">
            <Button size="sm" loading={save.isPending} onClick={onSave} disabled={tooLong}>
              {t('tone.guidance.save')}
            </Button>
            <Button size="sm" variant="ghost" disabled={save.isPending} onClick={() => setEditing(false)}>
              {t('common:actions.cancel')}
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          {cfg.guidance.trim() ? (
            <p className="whitespace-pre-line rounded-ctl bg-sunken p-3 text-sm leading-relaxed text-ink/90">{cfg.guidance}</p>
          ) : (
            <p className="text-sm text-muted">{t('tone.guidance.empty')}</p>
          )}
          <p className="text-xs text-subtle">
            {cfg.updated_by ? t('tone.guidance.updatedBy', { name: cfg.updated_by, date: fmt.date(cfg.updated_at) }) : t('tone.guidance.updatedAt', { date: fmt.date(cfg.updated_at) })}
          </p>
          <div className="flex flex-wrap items-center gap-2">
            {canEdit ? (
              <Button
                size="sm"
                variant="secondary"
                icon={<Pencil className="size-3.5" aria-hidden />}
                onClick={() => {
                  setText(cfg.guidance)
                  setEnabled(cfg.enabled)
                  save.reset()
                  setEditing(true)
                }}
              >
                {t('tone.guidance.edit')}
              </Button>
            ) : (
              <ReadOnlyNote />
            )}
            <Button size="sm" variant="link" asChild>
              <Link to="/workspace/settings/sentiment">{t('tone.guidance.settingsLink')}</Link>
            </Button>
          </div>
        </div>
      )}
    </Card>
  )
}
