/**
 * Timed trivia for bonus points. Picks a random unanswered question, shuffles
 * its options (each keeps its original index), ticks every 250 ms and
 * auto-submits a miss (-1) at zero.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { CircleCheck, CircleX, HelpCircle, Sparkles, TimerOff } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Badge, Button, Card, ErrorState, Skeleton, toastError } from '@/components/ui'
import { cn } from '@/lib/cn'
import { formatNumber } from '@/lib/format'
import { dropInProps } from '@/lib/motion'
import type { TriviaPrompt } from '@/types'
import { useAnswerTrivia, useTriviaState } from '../api'

type Phase = 'idle' | 'question' | 'result'
interface Current {
  prompt: TriviaPrompt
  order: number[]
}
interface Result {
  correct: boolean
  timedOut: boolean
  points: number
}

const TICK_MS = 250
const LETTERS = ['A', 'B', 'C', 'D']

function shuffle(n: number): number[] {
  const a = Array.from({ length: n }, (_, i) => i)
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    const tmp = a[i]!
    a[i] = a[j]!
    a[j] = tmp
  }
  return a
}

export function TriviaPanel() {
  const { t } = useTranslation('hub')
  const state = useTriviaState()
  const answer = useAnswerTrivia()
  const [phase, setPhase] = useState<Phase>('idle')
  const [current, setCurrent] = useState<Current | null>(null)
  const [msLeft, setMsLeft] = useState(0)
  const [result, setResult] = useState<Result | null>(null)
  const submitted = useRef(false)

  const submit = useCallback(
    (questionId: string, selectedIndex: number) => {
      if (submitted.current) return
      submitted.current = true
      answer.mutate(
        { questionId, selectedIndex },
        {
          onSuccess: (res) => {
            setResult({ correct: res.correct, timedOut: res.timedOut, points: res.pointsAwarded })
            setPhase('result')
          },
          onError: (error) => {
            toastError(error)
            setResult(null)
            setPhase('idle')
          },
          onSettled: () => setCurrent(null),
        },
      )
    },
    [answer],
  )

  // The question clock: wall-clock deadline, 250 ms ticks, a miss at zero.
  useEffect(() => {
    if (phase !== 'question' || !current) return
    const deadline = Date.now() + current.prompt.seconds * 1000
    const questionId = current.prompt.id
    setMsLeft(current.prompt.seconds * 1000)
    const timer = window.setInterval(() => {
      const left = deadline - Date.now()
      if (left <= 0) {
        window.clearInterval(timer)
        setMsLeft(0)
        submit(questionId, -1)
      } else {
        setMsLeft(left)
      }
    }, TICK_MS)
    return () => window.clearInterval(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, current])

  const remaining = state.data?.remaining ?? []

  const start = () => {
    if (remaining.length === 0) return
    const prompt = remaining[Math.floor(Math.random() * remaining.length)]!
    submitted.current = false
    setResult(null)
    setMsLeft(prompt.seconds * 1000)
    setCurrent({ prompt, order: shuffle(prompt.options.length) })
    setPhase('question')
  }

  if (state.isLoading) {
    return (
      <Card padding="lg" className="space-y-3">
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-12 w-full" />
      </Card>
    )
  }
  if (state.isError) return <ErrorState error={state.error} onRetry={() => void state.refetch()} />
  const data = state.data
  if (!data || data.totalCount === 0) return null

  const secondsLeft = Math.ceil(msLeft / 1000)
  const urgent = phase === 'question' && secondsLeft <= 5
  const busy = answer.isPending

  return (
    <Card padding="none" className="overflow-hidden" aria-labelledby="trivia-title">
      <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-4">
        <h2 id="trivia-title" className="flex items-center gap-2 font-display text-lg text-ink">
          <HelpCircle className="size-5 text-primary" strokeWidth={1.75} aria-hidden />
          {t('trivia.title')}
        </h2>
        <span className="whitespace-nowrap rounded-chip bg-sunken px-2.5 py-1 text-xs text-muted">
          {t('trivia.earned')}{' '}
          <span className="font-mono font-bold tabular-nums text-ink">{formatNumber(data.earnedPoints)}</span>
        </span>
      </div>

      <div className="p-5" aria-live="polite">
        <AnimatePresence mode="wait" initial={false}>
          {phase === 'question' && current ? (
            <motion.div key={`q-${current.prompt.id}`} {...dropInProps} exit={{ opacity: 0 }}>
              <div className="mb-3 flex items-center justify-between gap-3">
                <Badge tone="accent">{t('trivia.worth', { points: current.prompt.points })}</Badge>
                <span
                  className={cn(
                    'font-mono text-xl font-bold tabular-nums',
                    urgent ? 'animate-timer-pulse text-danger' : 'text-ink',
                  )}
                  aria-label={t('trivia.secondsLeft', { count: secondsLeft })}
                >
                  {secondsLeft}
                  {t('common:units.seconds')}
                </span>
              </div>
              <div className="mb-4 h-1.5 overflow-hidden rounded-chip bg-sunken" aria-hidden>
                <div
                  className={cn('h-full rounded-chip transition-[width] duration-200 ease-linear', urgent ? 'bg-danger' : 'bg-primary')}
                  style={{ width: `${Math.max(0, (msLeft / (current.prompt.seconds * 1000)) * 100)}%` }}
                />
              </div>
              <p className="text-base font-semibold text-ink sm:text-lg">{current.prompt.question}</p>
              <div className="mt-4 grid gap-2.5 sm:grid-cols-2">
                {current.order.map((originalIndex, position) => (
                  <button
                    key={originalIndex}
                    type="button"
                    disabled={busy}
                    onClick={() => submit(current.prompt.id, originalIndex)}
                    className="flex min-h-12 items-center gap-3 rounded-card border border-line bg-panel px-3.5 py-2.5 text-left text-sm text-ink transition-colors hover:border-primary hover:bg-primary-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-50"
                  >
                    <span className="grid size-7 shrink-0 place-items-center rounded-chip bg-sunken font-mono text-xs font-bold text-muted">
                      {LETTERS[position]}
                    </span>
                    {current.prompt.options[originalIndex]}
                  </button>
                ))}
              </div>
            </motion.div>
          ) : phase === 'result' && result ? (
            <motion.div key="result" {...dropInProps} exit={{ opacity: 0 }} className="text-center">
              <ResultLine result={result} />
              <div className="mt-5">
                {remaining.length > 0 ? (
                  <>
                    <Button size="lg" block onClick={start} leftIcon={<Sparkles className="size-5" aria-hidden />}>
                      {t('trivia.next')}
                    </Button>
                    <p className="mt-2 text-xs text-muted">{t('trivia.left', { count: remaining.length })}</p>
                  </>
                ) : (
                  <Complete earned={data.earnedPoints} />
                )}
              </div>
            </motion.div>
          ) : remaining.length > 0 ? (
            <motion.div key="idle" {...dropInProps} exit={{ opacity: 0 }} className="text-center">
              <p className="mb-4 text-sm text-muted">{t('trivia.intro')}</p>
              <Button size="lg" block onClick={start} leftIcon={<Sparkles className="size-5" aria-hidden />}>
                {t('trivia.start')}
              </Button>
              <p className="mt-2 text-xs text-muted">{t('trivia.left', { count: remaining.length })}</p>
            </motion.div>
          ) : (
            <motion.div key="done" {...dropInProps} className="text-center">
              <Complete earned={data.earnedPoints} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </Card>
  )
}

function ResultLine({ result }: { result: Result }) {
  const { t } = useTranslation('hub')
  if (result.timedOut) {
    return (
      <p className="flex items-center justify-center gap-2 font-display text-xl text-warning">
        <TimerOff className="size-6" aria-hidden /> {t('trivia.timeout')}
      </p>
    )
  }
  if (result.correct) {
    return (
      <p className="flex items-center justify-center gap-2 font-display text-xl text-success">
        <CircleCheck className="size-6" aria-hidden /> {t('trivia.correct', { points: result.points })}
      </p>
    )
  }
  return (
    <p className="flex items-center justify-center gap-2 font-display text-xl text-danger">
      <CircleX className="size-6" aria-hidden /> {t('trivia.wrong')}
    </p>
  )
}

function Complete({ earned }: { earned: number }) {
  const { t } = useTranslation('hub')
  return (
    <div>
      <p className="font-display text-lg text-ink">{t('trivia.complete')}</p>
      <p className="mt-1 text-sm text-muted">
        {t('trivia.completeSub')}{' '}
        <span className="font-mono font-bold tabular-nums text-ink">{formatNumber(earned)}</span> {t('common:units.points')}
      </p>
    </div>
  )
}
