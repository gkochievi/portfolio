import { Copy, FileText, Languages, RotateCcw, Timer } from 'lucide-react'
import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Badge, Button, Callout, CopyButton, Spinner } from '@/components/ui'
import { cn } from '@/lib/cn'
import { formatClock } from '@/lib/format'
import { useLimits, useTranscribe, type TranscribeResult } from '../api'
import { AudioSource, type PickedAudio, type SampleChoice } from './AudioSource'
import { ErrorNote } from './ErrorNote'

const SAMPLE_COUNT = 5

/** Speaker-prefixed lines ("Agent: ...") rendered as a dialogue. */
export function Dialogue({ transcript }: { transcript: string }) {
  const lines = transcript
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const match = /^([^:\n]{2,24}):\s*(.*)$/.exec(line)
      return match ? { who: match[1] as string, text: match[2] as string } : { who: '', text: line }
    })
  const first = lines.find((l) => l.who)?.who
  return (
    <ol className="flex flex-col gap-2.5">
      {lines.map((line, i) => (
        <li key={i} className="grid grid-cols-[88px_1fr] items-start gap-3 text-sm sm:grid-cols-[110px_1fr]">
          {line.who ? (
            <span
              className={cn(
                'truncate rounded-pill px-2 py-0.5 text-center text-xs font-medium',
                line.who === first ? 'bg-primary/12 text-primary' : 'bg-accent/15 text-accent',
              )}
            >
              {line.who}
            </span>
          ) : (
            <span />
          )}
          <p className="text-ink">{line.text}</p>
        </li>
      ))}
    </ol>
  )
}

export function useSamples(next: number): SampleChoice[] {
  const { t } = useTranslation('voiceTools')
  return [{ label: t('source.useSample'), sample: next, name: `sample-call-${(next % SAMPLE_COUNT) + 1}.wav`, size: 640_000 + next * 42_000 }]
}

export function TranscribePanel() {
  const { t } = useTranslation('voiceTools')
  const limits = useLimits()
  const mutation = useTranscribe()
  const [picked, setPicked] = useState<PickedAudio | null>(null)
  const [result, setResult] = useState<TranscribeResult | null>(null)
  const sampleCounter = useRef(0)
  const [, force] = useState(0)

  const remaining = limits.data?.remaining.analyses ?? 1
  const blocked = limits.data ? !limits.data.enabled || !limits.data.features.analyze || remaining <= 0 : false

  const run = (audio: PickedAudio) => {
    mutation.mutate(
      { name: audio.name, size: audio.size, sample: audio.sample, canned_id: audio.canned_id },
      { onSuccess: setResult },
    )
  }

  const onPick = (next: PickedAudio | null) => {
    setPicked(next)
    setResult(null)
    mutation.reset()
    if (next?.origin === 'sample' && !blocked) {
      sampleCounter.current += 1
      force((n) => n + 1)
      run(next)
    }
  }

  const reset = () => {
    setPicked(null)
    setResult(null)
    mutation.reset()
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
      <div className="flex flex-col gap-4">
        <p className="text-sm text-muted">{t('transcribe.lead')}</p>
        <AudioSource
          value={picked}
          onChange={onPick}
          maxMb={limits.data?.max_audio_mb ?? 10}
          disabled={mutation.isPending || blocked}
          samples={useSamples(sampleCounter.current)}
        />
        {picked && !result ? (
          <Button size="lg" icon={<FileText />} loading={mutation.isPending} disabled={blocked} onClick={() => run(picked)}>
            {mutation.isPending ? t('transcribe.working') : t('transcribe.run')}
          </Button>
        ) : null}
        {blocked && limits.data?.enabled && remaining <= 0 ? <p className="text-sm text-danger">{t('quota.exhausted.analyses')}</p> : null}
        <ErrorNote error={mutation.error} />
        <Callout tone="info">{t('transcribe.demoNote')}</Callout>
      </div>

      <div className="min-h-[220px] rounded-card border border-line bg-panel p-4 sm:p-5">
        {mutation.isPending ? (
          <div className="flex h-full min-h-[200px] flex-col items-center justify-center gap-3 text-muted">
            <Spinner size={22} />
            <p className="text-sm">{t('transcribe.working')}</p>
          </div>
        ) : result ? (
          <div className="flex flex-col gap-4 animate-panel-in">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="mr-auto font-display text-lg text-ink">{t('transcribe.result')}</h3>
              <Badge tone="primary" icon={<Languages />}>
                {t('transcribe.detected', { language: t(`languages.${result.language}`) })}
              </Badge>
              <Badge icon={<Timer />}>{formatClock(result.duration_s)}</Badge>
            </div>
            <Dialogue transcript={result.transcript} />
            <div className="flex flex-wrap gap-2 border-t border-line pt-3">
              <CopyButton value={result.transcript} withText size="sm" variant="secondary" />
              <Button size="sm" variant="ghost" icon={<RotateCcw />} onClick={reset}>
                {t('transcribe.again')}
              </Button>
              <span className="ml-auto self-center text-xs text-subtle">{t('transcribe.took', { s: (result.processing_ms / 1000).toFixed(1), model: result.model })}</span>
            </div>
          </div>
        ) : (
          <div className="flex h-full min-h-[200px] flex-col items-center justify-center gap-2 text-center text-muted">
            <Copy className="size-6 text-subtle" aria-hidden />
            <p className="max-w-xs text-sm">{t('transcribe.empty')}</p>
          </div>
        )}
      </div>
    </div>
  )
}
