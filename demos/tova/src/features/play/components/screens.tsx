/** The non-canvas states of /play: intro, game over and game closed. */
import { motion } from 'framer-motion'
import { Clock, Home, Keyboard, MousePointer2, RotateCcw, Trophy } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'

import { FlakeGlyph, ItemToken } from '@/components/brand'
import { Badge, Button, Countdown } from '@/components/ui'
import { cn } from '@/lib/cn'
import { formatDateTime, formatNumber, formatSigned } from '@/lib/format'
import { dropIn, stagger } from '@/lib/motion'
import type { GameEvent, ItemDef, ScoreResult } from '@/types'
import { FlakeBurst, PlayTopBar, useCountUp, useItemLabel } from './bits'

const SPEED_LABEL = { 1: '1', 2: '1.5', 3: '2' } as const

/* ------------------------------------------------------------------ intro */

export function PlayIntro({
  event,
  items,
  best,
  hasBest,
  onStart,
}: {
  event: GameEvent
  items: ItemDef[]
  best: number
  hasBest: boolean
  onStart: () => void
}) {
  const { t, i18n } = useTranslation('play')
  const label = useItemLabel()
  // One legend row per distinct item (an event may list the same art twice).
  const legend = items.filter(
    (item, i) => items.findIndex((o) => o.name === item.name && o.type === item.type && o.points === item.points) === i,
  )
  const sponsors = legend.filter((item) => item.points > 0)
  const hazards = legend.filter((item) => item.points < 0)

  return (
    <div className="absolute inset-0 overflow-y-auto">
      <div className="flex min-h-full flex-col px-4 pb-4 pt-3">
        <PlayTopBar />
        <motion.div variants={stagger} initial="hidden" animate="show" className="flex flex-1 flex-col gap-5 pt-6">
          <motion.div variants={dropIn}>
            <p className="text-sm font-semibold text-accent-ink">{event.name}</p>
            <h1 className="mt-1 font-display text-[32px] font-extrabold leading-[1.05] text-ink sm:text-[40px]">{t('title')}</h1>
            <p className="mt-2 text-[15px] leading-relaxed text-muted">{t('intro.lead', { seconds: event.durationSeconds })}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Badge tone="primary" icon={<Clock className="size-3.5" />}>
                {t('intro.seconds', { count: event.durationSeconds })}
              </Badge>
              <Badge tone="neutral">{t(`intro.difficulty.${event.difficulty}`)}</Badge>
              <Badge tone="neutral">{t('intro.speed', { value: SPEED_LABEL[event.speedLevel] })}</Badge>
            </div>
          </motion.div>

          <motion.section variants={dropIn} aria-labelledby="legend-title" className="rounded-hero border-[1.5px] border-line bg-panel p-4 shadow-card">
            <h2 id="legend-title" className="text-sm font-semibold text-muted">
              {t('intro.legendTitle')}
            </h2>
            <ul className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2.5 sm:grid-cols-3">
              {[...sponsors, ...hazards].map((item) => (
                <li key={item.id} className="flex min-w-0 items-center gap-2.5">
                  <ItemToken type={item.type} imageUrl={item.imageUrl} name={label(item.name)} size={36} />
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium text-ink">{label(item.name)}</span>
                    <span
                      className={cn(
                        'block font-mono text-[13px] font-bold tabular-nums',
                        item.points > 0 ? 'text-primary' : 'text-danger',
                      )}
                    >
                      {formatSigned(item.points, i18n.language)}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
            <div className="mt-4 grid gap-2 border-t border-line pt-3 text-sm text-muted">
              <p className="flex items-center gap-2.5">
                {sponsors[0] ? <ItemToken type="GOOD" imageUrl={sponsors[0].imageUrl} name={t('intro.bonusTitle')} size={28} bonus /> : null}
                <span>
                  <span className="font-semibold text-ink">{t('intro.bonusTitle')}.</span> {t('intro.bonusHint')}
                </span>
              </p>
              {hazards[0] ? (
                <p className="flex items-center gap-2.5">
                  <ItemToken type={hazards[0].type} name={label(hazards[0].name)} size={28} />
                  <span>{t('intro.hazardHint')}</span>
                </p>
              ) : null}
            </div>
          </motion.section>

          <motion.div variants={dropIn} className="grid gap-1.5 text-sm text-muted">
            <p className="flex items-center gap-2">
              <MousePointer2 className="size-4 shrink-0 text-primary" aria-hidden />
              {t('intro.controlsTouch')}
            </p>
            <p className="flex items-center gap-2">
              <Keyboard className="size-4 shrink-0 text-primary" aria-hidden />
              {t('intro.controlsKeys')}
            </p>
          </motion.div>

          <motion.div variants={dropIn} className="mt-auto grid gap-3 pt-2">
            <div className="flex items-center justify-between rounded-card bg-sunken px-4 py-3">
              <span className="flex items-center gap-2 text-sm font-semibold text-muted">
                <Trophy className="size-4 text-accent-ink" aria-hidden />
                {t('intro.best')}
              </span>
              {hasBest ? (
                <span className="font-mono text-xl font-bold tabular-nums text-ink">{formatNumber(best, i18n.language)}</span>
              ) : (
                <span className="text-sm text-muted">{t('intro.noBest')}</span>
              )}
            </div>
            <Button size="lg" block onClick={onStart} autoFocus>
              {t('intro.start')}
            </Button>
          </motion.div>
        </motion.div>
      </div>
    </div>
  )
}

/* -------------------------------------------------------------- game over */

export function GameOver({
  final,
  best,
  saving,
  result,
  error,
  reducedMotion,
  onRetrySave,
  onNewRound,
}: {
  final: number
  best: number
  saving: boolean
  result: ScoreResult | null
  error: string | null
  reducedMotion: boolean
  onRetrySave: () => void
  onNewRound: () => void
}) {
  const { t, i18n } = useTranslation('play')
  const shown = useCountUp(final, !reducedMotion)
  const neg = shown < 0

  return (
    <div className="absolute inset-0 z-30 overflow-y-auto bg-surface/85">
      {!reducedMotion && <FlakeBurst count={36} />}
      <div className="relative z-10 flex min-h-full flex-col px-4 pb-4 pt-3">
        <PlayTopBar />
        <motion.div variants={stagger} initial="hidden" animate="show" className="flex flex-1 flex-col items-center justify-center gap-4 py-6 text-center">
          <motion.h2 variants={dropIn} className="font-display text-[32px] font-extrabold leading-none text-ink sm:text-[40px]">
            {t('over.title')}
          </motion.h2>
          <motion.div variants={dropIn} className="w-full max-w-[340px] rounded-hero border-[1.5px] border-line bg-panel px-6 py-5 shadow-pop">
            <div className="text-sm font-semibold text-muted">{t('over.finalScore')}</div>
            <div
              className={cn('mt-1 font-mono text-[56px] font-bold leading-none tabular-nums', neg ? 'text-danger' : 'text-ink')}
              aria-live="polite"
              aria-atomic
            >
              {neg ? '−' : ''}
              {formatNumber(Math.abs(shown), i18n.language)}
            </div>
            {result?.isNewBest ? (
              <div className="mt-3">
                <Badge tone="accent" icon={<Trophy className="size-3.5" />}>
                  {t('over.newBest')}
                </Badge>
              </div>
            ) : null}
            <p className="mt-3 text-sm text-muted">
              {t('over.best')}: <span className="font-mono font-bold tabular-nums text-ink">{formatNumber(best, i18n.language)}</span>
              {saving ? <span className="ml-2">· {t('over.saving')}</span> : null}
              {result && !saving ? <span className="ml-2 text-success">· {t('over.saved')}</span> : null}
            </p>
            {error ? (
              <div className="mt-3 rounded-card bg-danger-soft px-3 py-2 text-sm text-danger" role="alert">
                <p>{t(error)}</p>
                {error !== 'play:errors.eventClosed' ? (
                  <button type="button" onClick={onRetrySave} className="mt-1 font-semibold underline underline-offset-2">
                    {t('over.retry')}
                  </button>
                ) : null}
              </div>
            ) : null}
          </motion.div>
          <motion.p variants={dropIn} className="max-w-[360px] text-[15px] font-medium leading-relaxed text-accent-ink">
            {t('over.cta')}
          </motion.p>
          <motion.div variants={dropIn} className="grid w-full max-w-[340px] gap-2.5">
            <Button size="lg" block onClick={onNewRound} leftIcon={<RotateCcw className="size-5" />} autoFocus>
              {t('over.newRound')}
            </Button>
            <Button size="lg" block variant="secondary" asChild>
              <Link to="/me">{t('over.myResults')}</Link>
            </Button>
            <Button size="md" block variant="ghost" asChild>
              <Link to="/">
                <Home className="size-4" aria-hidden />
                {t('over.home')}
              </Link>
            </Button>
          </motion.div>
        </motion.div>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------ game closed */

export function GameClosed({ upcoming, onOpened }: { upcoming: GameEvent | null; onOpened: () => void }) {
  const { t, i18n } = useTranslation('play')
  return (
    <div className="relative min-h-[100dvh] w-full bg-linear-to-b from-sky-top to-sky-bottom">
      <div className="mx-auto flex min-h-[100dvh] max-w-[520px] flex-col px-4 pb-6 pt-3">
        <PlayTopBar />
        <motion.div variants={stagger} initial="hidden" animate="show" className="flex flex-1 flex-col items-center justify-center gap-5 py-8 text-center">
          <motion.div variants={dropIn} className="grid size-16 place-items-center rounded-full bg-panel text-primary shadow-card">
            <FlakeGlyph size={30} />
          </motion.div>
          <motion.h1 variants={dropIn} className="font-display text-[32px] font-extrabold leading-[1.1] text-ink sm:text-[40px]">
            {t('closed.title')}
          </motion.h1>
          {upcoming ? (
            <motion.div variants={dropIn} className="w-full rounded-hero border-[1.5px] border-line bg-panel p-5 shadow-card">
              <p className="text-sm font-semibold text-muted">{t('closed.next')}</p>
              <p className="mt-1 font-display text-xl font-extrabold text-ink">{upcoming.name}</p>
              <p className="mt-1 text-sm text-muted">
                {t('closed.startsAt', { date: formatDateTime(upcoming.startsAt, i18n.language) })}
              </p>
              <Countdown to={upcoming.startsAt} size="lg" onDone={onOpened} className="mt-3 block text-primary" />
            </motion.div>
          ) : (
            <motion.p variants={dropIn} className="max-w-[360px] text-[15px] leading-relaxed text-muted">
              {t('closed.checkBack')}
            </motion.p>
          )}
          <motion.div variants={dropIn} className="grid w-full gap-2.5 pt-2">
            <Button size="lg" block asChild>
              <Link to="/leaderboard">{t('closed.standings')}</Link>
            </Button>
            <Button size="lg" block variant="secondary" asChild>
              <Link to="/">{t('closed.home')}</Link>
            </Button>
          </motion.div>
        </motion.div>
      </div>
    </div>
  )
}
