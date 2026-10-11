import { Gauge, Pause, Play } from 'lucide-react'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import { Waveform } from '@/components/brand'
import { Button, Callout, Tooltip } from '@/components/ui'
import { formatClock } from '@/lib/format'
import type { Recording } from '@/types'
import { buildRibbon } from '../lib'
import type { PlayerState } from './usePlayer'

export function Player({ rec, player }: { rec: Recording; player: PlayerState }) {
  const { t } = useTranslation('workbench')
  const ribbon = useMemo(() => buildRibbon(rec), [rec])
  const duration = rec.duration_s ?? 0

  return (
    <div className="rounded-card border border-line bg-panel p-4">
      <div className="flex flex-wrap items-center gap-3">
        <Button
          variant="primary"
          size="sm"
          icon={player.playing ? <Pause className="size-4" /> : <Play className="size-4" />}
          onClick={player.toggle}
          aria-keyshortcuts="Space"
          className="min-w-24"
        >
          {player.playing ? t('player.pause') : t('player.play')}
        </Button>
        <Tooltip content={t('player.speed')}>
          <Button variant="secondary" size="sm" icon={<Gauge className="size-4" />} onClick={player.cycleRate} className="tabular min-w-16">
            {player.rate}x
          </Button>
        </Tooltip>
        <div className="font-mono text-sm tabular text-muted" aria-live="off">
          <span className="text-ink">{formatClock(player.time)}</span> / {formatClock(duration)}
        </div>
        <span className="ml-auto hidden text-xs text-subtle sm:inline">{t('player.hint')}</span>
      </div>
      <div className="mt-3 overflow-hidden">
        <Waveform
          peaks={rec.peaks ?? []}
          duration={duration}
          currentTime={player.time}
          onSeek={player.seek}
          ribbon={ribbon}
          label={t('player.position')}
        />
      </div>
      {player.simulated ? (
        <Callout tone="info" className="mt-3">
          {t('player.silent')}
        </Callout>
      ) : null}
    </div>
  )
}
