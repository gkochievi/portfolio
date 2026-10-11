/**
 * /play: the canvas round (intro, 3-2-1, play, game over and save), or the
 * game-closed state when no event is open.
 */
import { useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { ErrorState, Spinner } from '@/components/ui'
import { usePlayConfig } from '../api'
import { PlayTopBar } from '../components/bits'
import { GameRound } from '../components/GameRound'
import { GameClosed } from '../components/screens'

export default function PlayPage() {
  const { t } = useTranslation('play')
  const config = usePlayConfig()
  // While a round is under way (or its result is on screen) keep the game up
  // even if the event closes underneath it.
  const [busy, setBusy] = useState(false)
  const onBusyChange = useCallback((value: boolean) => setBusy(value), [])

  if (config.isPending) {
    return (
      <div className="grid min-h-[100dvh] place-items-center bg-linear-to-b from-sky-top to-sky-bottom">
        <Spinner label={t('loading')} />
      </div>
    )
  }

  if (config.isError) {
    return (
      <div className="min-h-[100dvh] bg-linear-to-b from-sky-top to-sky-bottom">
        <div className="mx-auto flex max-w-[520px] flex-col gap-8 px-4 pt-3">
          <PlayTopBar />
          <ErrorState error={config.error} onRetry={() => void config.refetch()} />
        </div>
      </div>
    )
  }

  const data = config.data
  if (!data.event && !busy) {
    return <GameClosed upcoming={data.upcoming} onOpened={() => void config.refetch()} />
  }

  return <GameRound config={data} onBusyChange={onBusyChange} />
}
