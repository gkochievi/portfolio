/**
 * Staff drill-down for one entrant: total/best/bonus/rounds, the catch
 * breakdown merged across their rounds, contact details and recent rounds.
 * Shown in a right-edge slide-over on /leaderboard and in a modal on
 * /admin/leaderboard. Radix Dialog handles Escape, the focus trap and
 * returning focus to the row that opened it.
 */
import { Mail, Phone } from 'lucide-react'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import { ItemToken } from '@/components/brand'
import { Avatar, ErrorState, Modal, SideSheet, Skeleton, SkeletonText, StatTile, Tooltip } from '@/components/ui'
import { cn } from '@/lib/cn'
import { formatDateTime, formatNumber } from '@/lib/format'
import type { LeaderRow } from '@/types'
import { usePlayerDetail, type PlayerDetailData } from '../api'

export interface PlayerDetailOverlayProps {
  /** The row whose details are open; null = closed. */
  row: LeaderRow | null
  eventId: string | null
  onClose: () => void
}

export function PlayerDetailSheet({ row, eventId, onClose }: PlayerDetailOverlayProps) {
  const { t } = useTranslation('standings')
  return (
    <SideSheet
      open={Boolean(row)}
      onOpenChange={(open) => !open && onClose()}
      title={row?.name ?? t('detail.title')}
      description={row?.company || undefined}
      width={520}
    >
      {row?.userId && <PlayerDetailBody userId={row.userId} eventId={eventId} />}
    </SideSheet>
  )
}

export function PlayerDetailModal({ row, eventId, onClose }: PlayerDetailOverlayProps) {
  const { t } = useTranslation('standings')
  return (
    <Modal
      open={Boolean(row)}
      onOpenChange={(open) => !open && onClose()}
      title={row?.name ?? t('detail.title')}
      description={row?.company || undefined}
      size="lg"
    >
      {row?.userId && <PlayerDetailBody userId={row.userId} eventId={eventId} wide />}
    </Modal>
  )
}

export function PlayerDetailBody({ userId, eventId, wide }: { userId: string; eventId: string | null; wide?: boolean }) {
  const { t } = useTranslation('standings')
  const query = usePlayerDetail(userId, eventId)

  if (query.isPending) return <DetailSkeleton />
  if (query.isError) return <ErrorState error={query.error} onRetry={() => void query.refetch()} />
  const detail = query.data
  return (
    <div className="space-y-7" aria-label={t('detail.title')}>
      <Totals detail={detail} />
      <div className={cn('space-y-7', wide && 'md:grid md:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] md:gap-6 md:space-y-0')}>
        <Breakdown detail={detail} />
        <div className="space-y-7">
          <Contact detail={detail} />
          <Recent detail={detail} />
        </div>
      </div>
    </div>
  )
}

function SectionTitle({ children }: { children: ReactNode }) {
  return <h3 className="mb-3 font-display text-sm text-ink">{children}</h3>
}

function Totals({ detail }: { detail: PlayerDetailData }) {
  const { t, i18n } = useTranslation('standings')
  const n = (value: number) => <span className="font-mono tabular-nums">{formatNumber(value, i18n.language)}</span>
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <StatTile label={t('detail.total')} value={n(detail.bestScore + detail.bonusPoints)} hint={t('detail.totalHint')} tone="accent" />
      <StatTile label={t('detail.best')} value={n(detail.bestScore)} />
      <StatTile label={t('detail.bonus')} value={n(detail.bonusPoints)} />
      <StatTile label={t('detail.plays')} value={n(detail.totalPlays)} />
    </div>
  )
}

function Breakdown({ detail }: { detail: PlayerDetailData }) {
  const { t, i18n } = useTranslation('standings')
  const n = (value: number) => formatNumber(value, i18n.language)
  const levelHead = (short: string, long: string) => (
    <th scope="col" className="w-11 px-1 py-2 text-right font-semibold">
      <Tooltip content={long}>
        <abbr title={long} tabIndex={0} className="cursor-help no-underline">
          {short}
        </abbr>
      </Tooltip>
    </th>
  )
  return (
    <section>
      <SectionTitle>{t('detail.collected')}</SectionTitle>
      {detail.breakdown.length === 0 ? (
        <p className="rounded-card bg-sunken px-4 py-6 text-center text-sm text-muted">{t('detail.noCollected')}</p>
      ) : (
        <div className="overflow-x-auto rounded-card border-[1.5px] border-line">
          <table className="w-full border-collapse text-sm">
            <thead className="bg-sunken text-xs text-muted">
              <tr>
                <th scope="col" className="px-3 py-2 text-left font-semibold">
                  {t('detail.item')}
                </th>
                {levelHead(t('detail.l1'), t('detail.level1'))}
                {levelHead(t('detail.l2'), t('detail.level2'))}
                {levelHead(t('detail.l3'), t('detail.level3'))}
                <th scope="col" className="w-14 px-3 py-2 text-right font-semibold">
                  {t('detail.rowTotal')}
                </th>
              </tr>
            </thead>
            <tbody>
              {detail.breakdown.map((row) => (
                <tr key={`${row.name}|${row.type}`} className="border-t border-line even:bg-zebra">
                  <td className="px-3 py-2">
                    <span className="flex min-w-0 items-center gap-2.5">
                      <ItemToken type={row.type} imageUrl={row.imageUrl ?? null} name={row.name} size={28} />
                      <span className={cn('truncate font-medium', row.type !== 'GOOD' && 'text-danger')}>{row.name}</span>
                    </span>
                  </td>
                  {[row.l1, row.l2, row.l3].map((value, index) => (
                    <td key={index} className={cn('px-1 py-2 text-right font-mono tabular-nums', value === 0 && 'text-muted')}>
                      {n(value)}
                    </td>
                  ))}
                  <td className="px-3 py-2 text-right font-mono font-bold tabular-nums">{n(row.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}

function Contact({ detail }: { detail: PlayerDetailData }) {
  const { t } = useTranslation('standings')
  const { profile } = detail
  const name = `${profile.firstName} ${profile.lastName}`.trim()
  const missing = <span className="text-muted">{t('detail.notProvided')}</span>
  const rows: { label: string; value: ReactNode }[] = [
    {
      label: t('detail.email'),
      value: profile.email ? (
        <a href={`mailto:${profile.email}`} className="inline-flex min-w-0 items-center gap-1.5 text-primary underline-offset-2 hover:underline">
          <Mail className="size-3.5 shrink-0" aria-hidden />
          <span className="truncate">{profile.email}</span>
        </a>
      ) : (
        missing
      ),
    },
    {
      label: t('detail.phone'),
      value: profile.phone ? (
        <a href={`tel:${profile.phone.replace(/\s+/g, '')}`} className="inline-flex items-center gap-1.5 font-mono tabular-nums text-primary underline-offset-2 hover:underline">
          <Phone className="size-3.5 shrink-0" aria-hidden />
          {profile.phone}
        </a>
      ) : (
        missing
      ),
    },
    { label: t('detail.company'), value: profile.company || missing },
    { label: t('detail.position'), value: profile.position || missing },
  ]
  return (
    <section>
      <SectionTitle>{t('detail.contact')}</SectionTitle>
      <div className="rounded-card border-[1.5px] border-line bg-panel p-4">
        <div className="mb-3 flex items-center gap-3">
          <Avatar name={name} tone="ink" />
          <p className="min-w-0 truncate font-semibold">{name}</p>
        </div>
        <dl className="space-y-2 text-sm">
          {rows.map((row) => (
            <div key={row.label} className="grid grid-cols-[6.5rem_minmax(0,1fr)] gap-2">
              <dt className="text-muted">{row.label}</dt>
              <dd className="min-w-0 break-words">{row.value}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  )
}

function Recent({ detail }: { detail: PlayerDetailData }) {
  const { t, i18n } = useTranslation('standings')
  return (
    <section>
      <SectionTitle>{t('detail.recent')}</SectionTitle>
      {detail.plays.length === 0 ? (
        <p className="text-sm text-muted">{t('detail.noRecent')}</p>
      ) : (
        <ol className="divide-y divide-line rounded-card border-[1.5px] border-line">
          {detail.plays.map((play, index) => (
            <li key={`${play.playedAt}-${index}`} className="flex items-center justify-between gap-3 px-3 py-2 text-sm even:bg-zebra">
              <span className="text-muted">{formatDateTime(play.playedAt, i18n.language)}</span>
              <span
                className={cn(
                  'font-mono font-bold tabular-nums',
                  play.score === detail.bestScore && detail.bestScore > 0 && 'text-accent-ink',
                  play.score < 0 && 'text-danger',
                )}
              >
                {formatNumber(play.score, i18n.language)}
              </span>
            </li>
          ))}
        </ol>
      )}
    </section>
  )
}

function DetailSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <Skeleton key={index} className="h-20" />
        ))}
      </div>
      <Skeleton className="h-40 w-full" />
      <SkeletonText lines={4} />
    </div>
  )
}
