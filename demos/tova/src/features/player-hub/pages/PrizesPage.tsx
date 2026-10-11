/** `/awards`: the current event's prizes, when the organiser has published them (staff always see). */
import { useState } from 'react'
import { motion } from 'framer-motion'
import { EyeOff, Gamepad2, Gift, Home, Trophy } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'

import { Badge, Button, Card, EmptyState, ErrorState, PageHeader, Skeleton } from '@/components/ui'
import { assetUrl } from '@/lib/assets'
import { dropIn, stagger } from '@/lib/motion'
import { useCurrentEvents, useMe } from '@/lib/queries'
import type { Prize } from '@/types'
import { useHubLiveSync, usePrizes } from '../api'

export default function PrizesPage() {
  const { t } = useTranslation('hub')
  useHubLiveSync()
  const prizes = usePrizes()
  const { data: me } = useMe()
  const { data: events } = useCurrentEvents()
  const staff = !!me?.isStaff
  const data = prizes.data
  const showStandings = staff || !!events?.current?.leaderboardVisible
  const staffPreview = staff && !!data?.event && !data.event.awardsVisible

  const actions = (
    <div className="grid gap-3">
      <Button asChild size="lg" block>
        <Link to="/play">
          <Gamepad2 className="size-5" aria-hidden />
          {t('prizes.play')}
        </Link>
      </Button>
      <div className="grid grid-cols-2 gap-3">
        {showStandings && (
          <Button asChild variant="secondary" size="md" block>
            <Link to="/leaderboard">
              <Trophy className="size-4" aria-hidden />
              {t('prizes.standings')}
            </Link>
          </Button>
        )}
        <Button asChild variant="ghost" size="md" block className={showStandings ? undefined : 'col-span-2'}>
          <Link to="/">
            <Home className="size-4" aria-hidden />
            {t('prizes.home')}
          </Link>
        </Button>
      </div>
    </div>
  )

  return (
    <div className="space-y-6">
      <PageHeader
        variant="player"
        eyebrow={data?.event?.name ?? (prizes.isLoading ? <Skeleton className="h-4 w-40" /> : t('prizes.eyebrow'))}
        title={t('prizes.title')}
        description={data?.visible && data.prizes.length > 0 ? t('prizes.description') : undefined}
      />

      {staffPreview && (
        <Badge tone="warning" icon={<EyeOff className="size-3.5" aria-hidden />}>
          {t('prizes.staffPreview')}
        </Badge>
      )}

      {prizes.isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {[0, 1].map((i) => (
            <Card key={i} padding="none" className="overflow-hidden">
              <Skeleton className="aspect-[4/3] w-full rounded-none" />
              <div className="space-y-2 p-4">
                <Skeleton className="h-5 w-2/3" />
                <Skeleton className="h-4 w-full" />
              </div>
            </Card>
          ))}
        </div>
      ) : prizes.isError ? (
        <ErrorState error={prizes.error} onRetry={() => void prizes.refetch()} />
      ) : !data?.event ? (
        <EmptyState title={t('common:empty.noEvent')} description={t('prizes.noEventHint')} />
      ) : !data.visible ? (
        <EmptyState
          icon={<Gift className="size-6" aria-hidden />}
          title={t('prizes.hiddenTitle')}
          description={t('prizes.hiddenHint')}
        />
      ) : data.prizes.length === 0 ? (
        <EmptyState icon={<Gift className="size-6" aria-hidden />} title={t('prizes.emptyTitle')} description={t('prizes.emptyHint')} />
      ) : (
        <motion.ul variants={stagger} initial="hidden" animate="show" className="grid gap-4 sm:grid-cols-2">
          {data.prizes.map((prize) => (
            <motion.li key={prize.id} variants={dropIn}>
              <PrizeCard prize={prize} />
            </motion.li>
          ))}
        </motion.ul>
      )}

      {actions}
    </div>
  )
}

function PrizeCard({ prize }: { prize: Prize }) {
  const [broken, setBroken] = useState(false)
  const src = assetUrl(prize.imageUrl)
  return (
    <Card padding="none" className="h-full overflow-hidden">
      <div className="aspect-[4/3] w-full bg-sunken">
        {src && !broken ? (
          <img src={src} alt="" loading="lazy" onError={() => setBroken(true)} className="size-full object-cover" />
        ) : (
          <div className="grid size-full place-items-center bg-accent-soft">
            <Trophy className="size-16 text-accent-ink" strokeWidth={1.5} aria-hidden />
          </div>
        )}
      </div>
      <div className="p-4">
        <h2 className="font-display text-base leading-snug text-ink">{prize.label}</h2>
        {prize.description && <p className="mt-1.5 text-sm text-muted">{prize.description}</p>}
      </div>
    </Card>
  )
}
