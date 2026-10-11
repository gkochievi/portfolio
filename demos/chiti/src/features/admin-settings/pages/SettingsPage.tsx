import { ArrowUpRight, Ban, Bot, Clock, GitFork, ListChecks, MessageCircleMore, MessageSquareText, Palette, Plug, SlidersHorizontal } from 'lucide-react'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useSearchParams } from 'react-router-dom'

import { PageHeader, Pill, Skeleton } from '@/components/ui'
import { cn } from '@/lib/cn'
import { themeSwatch } from '@/features/widget/themes'

import { useBans, useCustomFields, useQuickReplies, useSettings, useWorkingHours } from '../api'
import { BansPanel } from '../components/BansPanel'
import { FieldsPanel } from '../components/FieldsPanel'
import { IdentityPanel } from '../components/IdentityPanel'
import { RepliesPanel } from '../components/RepliesPanel'
import { RoutingPanel } from '../components/RoutingPanel'
import { HoursStatus, WorkingHoursPanel } from '../components/WorkingHoursPanel'
import { textIn } from '../shared'

type PanelId = 'hours' | 'identity' | 'routing' | 'fields' | 'replies' | 'bans'

const PANELS: PanelId[] = ['hours', 'identity', 'routing', 'fields', 'replies', 'bans']

const cardClass =
  'group flex min-h-[10.5rem] flex-col gap-3 rounded-ui border border-line bg-panel p-5 text-left transition-colors hover:bg-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent'

function CardBody({ icon, title, description, children, external }: { icon: ReactNode; title: string; description: string; children?: ReactNode; external?: boolean }) {
  return (
    <>
      <div className="flex items-start gap-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-ui bg-accent-soft text-accent [&_svg]:size-5">{icon}</span>
        <div className="min-w-0 flex-1">
          <h3 className="font-display text-[16px] font-semibold leading-tight text-ink">{title}</h3>
          <p className="mt-1 text-[13px] text-muted">{description}</p>
        </div>
        {external ? <ArrowUpRight className="size-4 shrink-0 text-muted transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" strokeWidth={1.75} aria-hidden /> : null}
      </div>
      {children ? <div className="mt-auto border-t border-line pt-3 text-[13px] text-ink">{children}</div> : null}
    </>
  )
}

function PanelCard({ id, onOpen, ...body }: { id: PanelId; onOpen: (id: PanelId) => void; icon: ReactNode; title: string; description: string; children?: ReactNode }) {
  return (
    <button type="button" className={cardClass} onClick={() => onOpen(id)} aria-haspopup="dialog">
      <CardBody {...body} />
    </button>
  )
}

function LinkCard({ to, ...body }: { to: string; icon: ReactNode; title: string; description: string }) {
  return (
    <Link to={to} className={cardClass}>
      <CardBody {...body} external />
    </Link>
  )
}

function Summary({ loading, children }: { loading: boolean; children: ReactNode }) {
  return loading ? <Skeleton className="h-5 w-3/4" /> : <>{children}</>
}

export default function SettingsPage() {
  const { t, i18n } = useTranslation('adminSettings')
  const tc = useTranslation().t
  const [params, setParams] = useSearchParams()
  const panelParam = params.get('panel')
  const panel = PANELS.find((id) => id === panelParam) ?? null

  const settings = useSettings()
  const hours = useWorkingHours()
  const fields = useCustomFields()
  const replies = useQuickReplies()
  const bans = useBans()

  const open = (id: PanelId) =>
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        next.set('panel', id)
        return next
      },
      { replace: false },
    )
  const close = () =>
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        next.delete('panel')
        return next
      },
      { replace: true },
    )

  const s = settings.data
  const status = hours.data?.status
  const enabledFields = (fields.data ?? []).filter((row) => row.enabled).length
  const dash = <span className="text-muted">{t('hub.unavailable')}</span>

  return (
    <div className="flex flex-col gap-8">
      <PageHeader title={t('hub.title')} description={t('hub.description')} />

      <section aria-labelledby="settings-core" className="flex flex-col gap-4">
        <h2 id="settings-core" className="font-display text-lg font-semibold text-ink">
          {t('hub.coreTitle')}
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <PanelCard id="hours" onOpen={open} icon={<Clock strokeWidth={1.75} />} title={t('hours.title')} description={t('hub.hours')}>
            <Summary loading={hours.isLoading}>
              {status ? (
                <div className="flex flex-col gap-1.5">
                  <HoursStatus status={status} />
                  <span className="text-muted">
                    {status.todayStart && status.todayEnd ? t('hub.todayHours', { start: status.todayStart, end: status.todayEnd }) : t('hub.closedToday')}
                  </span>
                </div>
              ) : (
                dash
              )}
            </Summary>
          </PanelCard>

          <PanelCard id="identity" onOpen={open} icon={<Palette strokeWidth={1.75} />} title={t('identity.title')} description={t('hub.identity')}>
            <Summary loading={settings.isLoading}>
              {s ? (
                <div className="flex items-center justify-between gap-3">
                  <span className="truncate font-medium">{textIn(s.chatTitle, i18n.language)}</span>
                  <span className="flex shrink-0 items-center gap-1" aria-label={t('hub.themesLabel')}>
                    {([s.clientTheme, s.operatorTheme, s.adminTheme] as const).map((theme, i) => (
                      <span key={i} title={tc(`theme.${theme}`)} className="size-4 rounded-full border border-line-strong" style={{ background: themeSwatch(theme) }} />
                    ))}
                  </span>
                </div>
              ) : (
                dash
              )}
            </Summary>
          </PanelCard>

          <PanelCard id="routing" onOpen={open} icon={<SlidersHorizontal strokeWidth={1.75} />} title={t('routing.title')} description={t('hub.routing')}>
            <Summary loading={settings.isLoading}>
              {s ? (
                <div className="flex flex-wrap items-center gap-1.5">
                  <Pill tone={s.operatorEnterDirectly ? 'success' : 'muted'} size="sm" dot>
                    {s.operatorEnterDirectly ? t('hub.autoOn') : t('hub.autoOff')}
                  </Pill>
                  {s.operatorEnterDirectly ? (
                    <Pill tone="neutral" size="sm">
                      {tc(`strategy.${s.chatDistributionStrategy}`)}
                    </Pill>
                  ) : null}
                  <span className={cn('text-muted')}>{s.operatorChatLimit === 0 ? t('hub.unlimited') : t('hub.limit', { count: s.operatorChatLimit })}</span>
                </div>
              ) : (
                dash
              )}
            </Summary>
          </PanelCard>

          <PanelCard id="fields" onOpen={open} icon={<ListChecks strokeWidth={1.75} />} title={t('fields.title')} description={t('hub.fields')}>
            <Summary loading={fields.isLoading}>{fields.data ? t('hub.fieldsCount', { count: fields.data.length, enabled: enabledFields }) : dash}</Summary>
          </PanelCard>

          <PanelCard id="replies" onOpen={open} icon={<MessageSquareText strokeWidth={1.75} />} title={t('replies.title')} description={t('hub.replies')}>
            <Summary loading={replies.isLoading}>{replies.data ? t('hub.repliesCount', { count: replies.data.length }) : dash}</Summary>
          </PanelCard>

          <PanelCard id="bans" onOpen={open} icon={<Ban strokeWidth={1.75} />} title={t('bans.title')} description={t('hub.bans')}>
            <Summary loading={bans.isLoading}>{bans.data ? t('hub.bansCount', { count: bans.data.length }) : dash}</Summary>
          </PanelCard>
        </div>
      </section>

      <section aria-labelledby="settings-more" className="flex flex-col gap-4">
        <div>
          <h2 id="settings-more" className="font-display text-lg font-semibold text-ink">
            {t('hub.moreTitle')}
          </h2>
          <p className="mt-0.5 text-[13px] text-muted">{t('hub.moreDescription')}</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <LinkCard to="/admin/settings/faq" icon={<GitFork strokeWidth={1.75} />} title={t('links.faq.title')} description={t('links.faq.description')} />
          <LinkCard to="/admin/settings/channels" icon={<Plug strokeWidth={1.75} />} title={t('links.channels.title')} description={t('links.channels.description')} />
          <LinkCard to="/admin/settings/comments" icon={<MessageCircleMore strokeWidth={1.75} />} title={t('links.comments.title')} description={t('links.comments.description')} />
          <LinkCard to="/admin/settings/ai" icon={<Bot strokeWidth={1.75} />} title={t('links.ai.title')} description={t('links.ai.description')} />
        </div>
      </section>

      {panel === 'hours' ? <WorkingHoursPanel onClose={close} /> : null}
      {panel === 'identity' ? <IdentityPanel onClose={close} /> : null}
      {panel === 'routing' ? <RoutingPanel onClose={close} /> : null}
      {panel === 'fields' ? <FieldsPanel onClose={close} /> : null}
      {panel === 'replies' ? <RepliesPanel onClose={close} /> : null}
      {panel === 'bans' ? <BansPanel onClose={close} /> : null}
    </div>
  )
}
