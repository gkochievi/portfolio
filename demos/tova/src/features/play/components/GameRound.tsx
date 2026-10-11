/**
 * One event's game: intro → 3-2-1 → canvas round → game over and save.
 * The engine is built fresh for every round from the latest config, so
 * console changes (caps, difficulty, speed, duration, items) reach the next round.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { isApiError } from '@/api/client'
import { assetUrl } from '@/lib/assets'
import { useBrandColors, type BrandColors } from '@/lib/brand'
import { useReducedMotion } from '@/lib/motion'
import type { PlayConfig, ScoreResult, ScoreSubmit } from '@/types'
import { useSubmitScore } from '../api'
import { TovaGame, type EngineColors, type EngineItem } from '../engine/TovaGame'
import { RING_C, ScoreBox, TimerRing, useItemLabel } from './bits'
import { GameOver, PlayIntro } from './screens'

type Phase = 'intro' | 'countdown' | 'playing' | 'over'

const engineColors = (c: BrandColors): EngineColors => ({
  primary: c.primary,
  primaryEdge: c.primaryEdge,
  accent: c.accent,
  accentInk: c.accentInk,
  onAccent: c.surface === '#071B20' ? '#071B20' : '#0B2A31',
  panel: c.panel,
  ink: c.ink,
  muted: c.muted,
  danger: c.danger,
  frost: c.primary,
})

export function GameRound({ config, onBusyChange }: { config: PlayConfig; onBusyChange: (busy: boolean) => void }) {
  const { t } = useTranslation('play')
  const reducedMotion = useReducedMotion() ?? false
  const colors = useBrandColors()
  const label = useItemLabel()
  const submit = useSubmitScore()

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const ringRef = useRef<SVGCircleElement>(null)
  const engineRef = useRef<TovaGame | null>(null)
  // The config a round was started with (the query may refetch mid-round).
  const roundConfig = useRef<PlayConfig>(config)
  const lastSubmit = useRef<ScoreSubmit | null>(null)

  const [phase, setPhase] = useState<Phase>('intro')
  const [round, setRound] = useState(0)
  const [count, setCount] = useState(3)
  const [time, setTime] = useState(config.event?.durationSeconds ?? 60)
  const [score, setScore] = useState(0)
  const [final, setFinal] = useState(0)
  const [result, setResult] = useState<ScoreResult | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)

  useEffect(() => {
    onBusyChange(phase !== 'intro')
  }, [phase, onBusyChange])

  // Latest values for the engine callbacks without rebuilding it.
  const live = useRef({ colors, reducedMotion, label })
  live.current = { colors, reducedMotion, label }

  const engineColorsMemo = useMemo(() => engineColors(colors), [colors])
  useEffect(() => {
    engineRef.current?.setColors(engineColorsMemo)
  }, [engineColorsMemo])

  function save(body: ScoreSubmit) {
    lastSubmit.current = body
    setSaveError(null)
    submit.mutate(body, {
      onSuccess: (res) => setResult(res),
      onError: (error) => setSaveError(isApiError(error) ? error.message : 'play:errors.load'),
    })
  }

  // Build the engine and run the 3-2-1 for each round.
  useEffect(() => {
    if (phase !== 'countdown') return
    const canvas = canvasRef.current
    const cfg = roundConfig.current
    const event = cfg.event
    if (!canvas || !event) return

    const items: EngineItem[] = cfg.items.map((item) => ({
      ...item,
      imageUrl: assetUrl(item.imageUrl),
      label: live.current.label(item.name),
    }))

    const engine = new TovaGame(canvas, {
      items,
      duration: event.durationSeconds,
      maxGood: event.maxGood,
      maxBad: event.maxBad,
      difficulty: event.difficulty,
      speedLevel: event.speedLevel,
      colors: engineColors(live.current.colors),
      reducedMotion: live.current.reducedMotion,
      onTick: (remaining, s, exact) => {
        setTime(remaining)
        setScore(s)
        const ring = ringRef.current
        if (ring) ring.setAttribute('stroke-dashoffset', String(-RING_C * (1 - exact / event.durationSeconds)))
      },
      onEnd: (value) => {
        setFinal(value)
        setPhase('over')
        save({ eventId: event.id, score: value, duration: event.durationSeconds, breakdown: engine.getBreakdown() })
      },
    })
    engineRef.current = engine
    if (import.meta.env.DEV) (window as unknown as { __tovaRound?: unknown }).__tovaRound = engine.budget

    let n = 3
    setCount(3)
    setScore(0)
    setTime(event.durationSeconds)
    const iv = window.setInterval(() => {
      n -= 1
      if (n <= 0) {
        window.clearInterval(iv)
        setPhase('playing')
        engine.start()
      } else {
        setCount(n)
      }
    }, 1000)

    return () => {
      window.clearInterval(iv)
      engine.destroy()
      if (engineRef.current === engine) engineRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [round])

  function startRound() {
    if (!config.event) return
    roundConfig.current = config
    setResult(null)
    setSaveError(null)
    setFinal(0)
    setPhase('countdown')
    setRound((r) => r + 1)
  }

  // A new round from game over goes straight to the 3-2-1 with the latest config;
  // if the event has since closed, fall back to the intro so the page shows the closed state.
  function newRound() {
    if (!config.event) {
      setPhase('intro')
      return
    }
    startRound()
  }

  const event = config.event
  const best = result ? result.best : Math.max(config.best, phase === 'over' && !saveError ? final : config.best)
  const hot = time <= 10

  return (
    <div className="relative flex h-[100dvh] w-full justify-center overflow-hidden bg-linear-to-b from-sky-top to-sky-bottom">
      <div className="relative h-full w-full max-w-[480px] overflow-hidden sm:border-x-[1.5px] sm:border-line">
        {phase === 'intro' && event ? (
          <PlayIntro event={event} items={config.items} best={config.best} hasBest={config.best > 0} onStart={startRound} />
        ) : null}

        {phase !== 'intro' ? (
          <canvas
            ref={canvasRef}
            className="absolute inset-0 size-full touch-none select-none"
            style={{ touchAction: 'none' }}
            aria-label={t('hud.canvas')}
            role="img"
          />
        ) : null}

        {(phase === 'countdown' || phase === 'playing') && (
          <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-start justify-between p-3">
            <TimerRing ref={ringRef} seconds={time} reducedMotion={reducedMotion} />
            <ScoreBox score={score} />
          </div>
        )}
        {phase === 'playing' && hot ? (
          <span className="sr-only" aria-live="polite">
            {time === 10 ? t('hud.secondsLeft', { count: 10 }) : ''}
          </span>
        ) : null}

        {phase === 'countdown' && (
          <div className="absolute inset-0 z-30 grid place-items-center bg-surface/40" aria-live="assertive">
            <div className="text-center">
              <p className="text-sm font-semibold text-muted">{t('countdown.label')}</p>
              <div key={count} className="animate-pop-in font-display text-[120px] font-extrabold leading-none text-primary">
                {count}
              </div>
            </div>
          </div>
        )}

        {phase === 'over' && (
          <GameOver
            final={final}
            best={best}
            saving={submit.isPending}
            result={result}
            error={saveError}
            reducedMotion={reducedMotion}
            onRetrySave={() => lastSubmit.current && save(lastSubmit.current)}
            onNewRound={newRound}
          />
        )}
      </div>
    </div>
  )
}
