import { AudioWaveform, MessageSquareText, RotateCcw, Sparkles } from 'lucide-react'
import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Badge, Button, Callout, Meter, Spinner } from '@/components/ui'
import { cn } from '@/lib/cn'
import type { Polarity, Sentiment } from '@/types'
import { useLimits, useSentimentRead, type SentimentResult } from '../api'
import { AudioSource, type PickedAudio } from './AudioSource'
import { ErrorNote } from './ErrorNote'
import { Dialogue, useSamples } from './TranscribePanel'

const polarityTone = { positive: 'success', neutral: 'neutral', negative: 'danger' } as const

/** -1..1 on a centred track. */
function PolarityBar({ value, label }: { value: number; label: string }) {
  const pct = Math.min(1, Math.abs(value)) * 50
  return (
    <div role="meter" aria-label={label} aria-valuemin={-1} aria-valuemax={1} aria-valuenow={value} className="relative h-3 rounded-pill bg-ink/10">
      <span className="absolute inset-y-0 left-1/2 w-px bg-line-strong" />
      <span
        className={cn('absolute inset-y-0 rounded-pill', value >= 0 ? 'bg-success' : 'bg-danger')}
        style={value >= 0 ? { left: '50%', width: `${pct}%` } : { right: '50%', width: `${pct}%` }}
      />
    </div>
  )
}

function Side({ icon, title, sub, children }: { icon: React.ReactNode; title: string; sub: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-4 rounded-card border border-line bg-panel p-4 sm:p-5">
      <header className="flex items-start gap-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-ctl bg-accent/12 text-accent">{icon}</span>
        <div>
          <h3 className="font-display text-lg leading-tight text-ink">{title}</h3>
          <p className="text-xs text-muted">{sub}</p>
        </div>
      </header>
      {children}
    </section>
  )
}

function Reading({ label, hint, value, children }: { label: string; hint: string; value: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-[13px] font-medium text-ink">{label}</span>
        <span className="tabular font-display text-lg leading-none text-ink">{value}</span>
      </div>
      {children}
      <p className="text-xs text-subtle">{hint}</p>
    </div>
  )
}

function Result({ data }: { data: SentimentResult }) {
  const { t } = useTranslation('voiceTools')
  const s: Sentiment = data.sentiment
  const conflict = s.agreement === 'conflict'
  const sign = (v: number) => `${v > 0 ? '+' : ''}${v.toFixed(2)}`
  return (
    <div className="flex flex-col gap-4 animate-panel-in">
      {conflict ? (
        <Callout tone="warning" title={t('sentiment.conflictTitle')}>
          {t('sentiment.conflictBody')}
        </Callout>
      ) : (
        <Callout tone={s.agreement === 'agree' ? 'success' : 'info'} title={t(`sentiment.agreement.${s.agreement}`)}>
          {t(`sentiment.agreementBody.${s.agreement}`)}
        </Callout>
      )}
      <div className="grid gap-4 md:grid-cols-2">
        <Side icon={<MessageSquareText className="size-5" />} title={t('sentiment.text')} sub={t('sentiment.textSub')}>
          {s.text ? (
            <>
              <Badge tone={polarityTone[s.text.label as Polarity]} size="md" className="self-start">
                {t(`sentiment.polarity.${s.text.label}`)}
              </Badge>
              <Reading label={t('sentiment.polarityLabel')} hint={t('sentiment.polarityHint')} value={sign(s.text.polarity)}>
                <PolarityBar value={s.text.polarity} label={t('sentiment.polarityLabel')} />
              </Reading>
              <p lang={data.language} className="rounded-ctl bg-sunken p-3 text-sm text-muted">
                {s.text.rationale}
              </p>
            </>
          ) : (
            <p className="text-sm text-muted">{t('sentiment.noText')}</p>
          )}
        </Side>
        <Side icon={<AudioWaveform className="size-5" />} title={t('sentiment.voice')} sub={t('sentiment.voiceSub')}>
          {s.prosody ? (
            <>
              <Badge tone={s.prosody.polarity > 0.15 ? 'success' : s.prosody.polarity < -0.15 ? 'danger' : 'neutral'} size="md" className="self-start">
                {t(`sentiment.emotions.${s.prosody.label}`)}
              </Badge>
              <Reading label={t('sentiment.arousal')} hint={t('sentiment.arousalHint')} value={s.prosody.arousal.toFixed(2)}>
                <Meter value={s.prosody.arousal} max={1} tone={s.prosody.arousal > 0.7 ? 'danger' : s.prosody.arousal > 0.45 ? 'warning' : 'success'} label={t('sentiment.arousal')} />
              </Reading>
              <Reading label={t('sentiment.valence')} hint={t('sentiment.valenceHint')} value={s.prosody.valence.toFixed(2)}>
                <Meter value={s.prosody.valence} max={1} tone={s.prosody.valence < 0.35 ? 'danger' : s.prosody.valence < 0.55 ? 'warning' : 'success'} label={t('sentiment.valence')} />
              </Reading>
              <p className="text-xs text-subtle">{t('sentiment.confidence', { pct: Math.round(s.prosody.confidence * 100) })}</p>
            </>
          ) : (
            <p className="text-sm text-muted">{t('sentiment.noVoice')}</p>
          )}
        </Side>
      </div>
      <div className="rounded-card border border-line bg-panel p-4 sm:p-5">
        <h4 className="mb-3 font-display text-base text-ink">{t('sentiment.transcript')}</h4>
        <Dialogue transcript={data.transcript} />
      </div>
    </div>
  )
}

export function SentimentPanel() {
  const { t } = useTranslation('voiceTools')
  const limits = useLimits()
  const mutation = useSentimentRead()
  const [picked, setPicked] = useState<PickedAudio | null>(null)
  const [result, setResult] = useState<SentimentResult | null>(null)
  const counter = useRef(0)
  const [, force] = useState(0)

  const remaining = limits.data?.remaining.analyses ?? 1
  const blocked = limits.data ? !limits.data.enabled || !limits.data.features.analyze || remaining <= 0 : false

  const run = (audio: PickedAudio) =>
    mutation.mutate({ name: audio.name, size: audio.size, sample: audio.sample, canned_id: audio.canned_id }, { onSuccess: setResult })

  const onPick = (next: PickedAudio | null) => {
    setPicked(next)
    setResult(null)
    mutation.reset()
    if (next?.origin === 'sample' && !blocked) {
      counter.current += 1
      force((n) => n + 1)
      run(next)
    }
  }

  const mismatch = () =>
    onPick({ name: 'sample-mismatch.wav', size: 702_000, origin: 'sample', canned_id: 'ct_02' })

  const samples = [
    ...useSamples(counter.current),
  ]

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="flex flex-col gap-3">
          <p className="text-sm text-muted">{t('sentiment.lead')}</p>
          <AudioSource value={picked} onChange={onPick} maxMb={limits.data?.max_audio_mb ?? 10} disabled={mutation.isPending || blocked} samples={samples} />
          <div className="flex flex-wrap gap-2">
            {picked && !result ? (
              <Button icon={<Sparkles />} loading={mutation.isPending} disabled={blocked} onClick={() => run(picked)}>
                {mutation.isPending ? t('sentiment.working') : t('sentiment.run')}
              </Button>
            ) : null}
            {!picked ? (
              <Button size="sm" variant="accent" icon={<Sparkles />} disabled={blocked || mutation.isPending} onClick={mismatch}>
                {t('sentiment.useMismatch')}
              </Button>
            ) : null}
            {result ? (
              <Button size="sm" variant="ghost" icon={<RotateCcw />} onClick={() => onPick(null)}>
                {t('transcribe.again')}
              </Button>
            ) : null}
          </div>
          {blocked && limits.data?.enabled && remaining <= 0 ? <p className="text-sm text-danger">{t('quota.exhausted.analyses')}</p> : null}
          <ErrorNote error={mutation.error} />
        </div>
        <Callout tone="info" title={t('sentiment.whyTitle')}>
          {t('sentiment.why')}
        </Callout>
      </div>
      {mutation.isPending ? (
        <div className="flex items-center justify-center gap-3 rounded-card border border-line bg-panel py-12 text-muted">
          <Spinner size={20} /> <span className="text-sm">{t('sentiment.working')}</span>
        </div>
      ) : result ? (
        <Result data={result} />
      ) : null}
    </div>
  )
}
