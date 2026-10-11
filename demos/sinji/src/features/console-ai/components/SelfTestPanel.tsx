/** Connection self-test: an ordered probe list that fills in one row at a time. */
import { useEffect, useRef, useState } from 'react'
import { CheckCircle2, CircleDashed, Loader2, Play, XCircle } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { errorMessage } from '@/api/client'
import { Badge, Button, Panel, SegmentedControl, toast } from '@/components/ui'
import { cn } from '@/lib/cn'
import { formatNumber } from '@/lib/format'
import type { SelfTestProbe } from '@/types'
import { useSelfTest } from '../api'
import type { SelfTestMode } from '../types'
import { translateDetail } from './bits'

const QUICK = ['database', 'embeddings', 'llm', 'stt', 'tts', 'voice_tone', 'storage'] as const
const DEEP = [...QUICK, 'kb_index', 'chat_gateway', 'job_queue'] as const

type Phase = 'idle' | 'running' | 'done'

export function SelfTestPanel() {
  const { t, i18n } = useTranslation('consoleAi')
  const lang = i18n.language
  const run = useSelfTest()
  const [mode, setMode] = useState<SelfTestMode>('quick')
  const [ranMode, setRanMode] = useState<SelfTestMode>('quick')
  const [phase, setPhase] = useState<Phase>('idle')
  const [results, setResults] = useState<SelfTestProbe[]>([])
  const timers = useRef<number[]>([])

  const clearTimers = () => {
    timers.current.forEach((id) => window.clearTimeout(id))
    timers.current = []
  }
  useEffect(() => clearTimers, [])

  const start = async () => {
    clearTimers()
    setResults([])
    setRanMode(mode)
    setPhase('running')
    try {
      const probes = await run.mutateAsync(mode)
      let at = 0
      probes.forEach((p, i) => {
        at += Math.min(750, Math.max(240, p.ms * 0.8))
        timers.current.push(
          window.setTimeout(() => {
            setResults((r) => [...r, p])
            if (i === probes.length - 1) setPhase('done')
          }, at),
        )
      })
    } catch (e) {
      setPhase('idle')
      toast.error(errorMessage(e))
    }
  }

  const ids = ranMode === 'deep' ? DEEP : QUICK
  const shown = phase === 'idle' && results.length === 0 ? (mode === 'deep' ? DEEP : QUICK) : ids
  const passed = results.filter((r) => r.ok).length
  const totalMs = results.reduce((sum, r) => sum + r.ms, 0)

  return (
    <Panel
      title={t('selfTest.title')}
      description={t('selfTest.description')}
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <SegmentedControl
            value={mode}
            onValueChange={(v) => setMode(v as SelfTestMode)}
            size="sm"
            options={[
              { value: 'quick', label: t('selfTest.quick') },
              { value: 'deep', label: t('selfTest.deep') },
            ]}
          />
          <Button variant="primary" icon={<Play />} loading={phase === 'running'} onClick={start} className="min-w-28">
            {phase === 'running' ? t('selfTest.running') : t('selfTest.run')}
          </Button>
        </div>
      }
    >
      <p className="mb-3 text-[13px] text-muted">{mode === 'deep' ? t('selfTest.deepNote') : t('selfTest.quickNote')}</p>
      <ol className="divide-y divide-line rounded-ctl border border-line" aria-live="polite" aria-busy={phase === 'running'}>
        {shown.map((id, i) => {
          const result = results[i]
          const running = phase === 'running' && i === results.length
          return (
            <li key={id} className="flex items-center gap-3 px-3 py-2.5 text-[13px]">
              <span className="grid size-5 shrink-0 place-items-center" aria-hidden>
                {result ? (
                  result.ok ? <CheckCircle2 className="size-[18px] text-success" /> : <XCircle className="size-[18px] text-danger" />
                ) : running ? (
                  <Loader2 className="size-[18px] animate-spin text-primary" />
                ) : (
                  <CircleDashed className="size-[18px] text-subtle" />
                )}
              </span>
              <span className="w-36 shrink-0 font-medium sm:w-48">{t(`selfTest.probes.${id}`)}</span>
              <span className={cn('min-w-0 flex-1 truncate', result && !result.ok ? 'text-danger' : 'text-muted')}>
                {result ? translateDetail(t, result.detail) : running ? t('selfTest.checking') : phase === 'running' ? t('selfTest.waiting') : '—'}
              </span>
              {result ? <span className="tabular shrink-0 font-mono text-xs text-subtle">{formatNumber(result.ms, lang)} ms</span> : null}
            </li>
          )
        })}
      </ol>
      {phase === 'done' ? (
        <div className="mt-3 flex flex-wrap items-center gap-2 text-[13px]">
          <Badge tone={passed === results.length ? 'success' : 'warning'}>
            {t('selfTest.summary', { passed, total: results.length })}
          </Badge>
          <span className="text-muted">{t('selfTest.took', { ms: formatNumber(totalMs, lang) })}</span>
        </div>
      ) : null}
    </Panel>
  )
}
