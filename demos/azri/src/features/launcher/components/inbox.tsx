/**
 * Building blocks of the SMS inbox launcher (/). Owner: launcher.
 */
import { motion } from 'framer-motion'
import {
  ArrowUpRight,
  CheckCheck,
  CircleSlash,
  Clock3,
  LayoutDashboard,
  Link2,
  Link2Off,
  MessageSquareText,
  Star,
} from 'lucide-react'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import { Avatar, Badge, BubbleCard, Button, Chip, LiveDot, Skeleton, StatusBadge, TenantMark } from '@/components/ui'
import { clock } from '@/demo/core'
import { useLang } from '@/hooks/useLang'
import { daysUntil, formatRelative } from '@/lib/format'
import { cn, lt } from '@/lib/utils'
import type { Tenant } from '@/types'

import type { BranchKind, BranchSample, InboxMessage, RecipientSummary } from '../types'

const ICON = { size: 20, strokeWidth: 1.75 } as const

/* ------------------------------------------------------------------- hero */

export function InboxHero() {
  const { t } = useTranslation('launcher')
  const steps = [
    { key: 'sms', icon: <MessageSquareText {...ICON} /> },
    { key: 'rate', icon: <Star {...ICON} /> },
    { key: 'console', icon: <LayoutDashboard {...ICON} /> },
  ] as const
  return (
    <section className="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:items-end">
      <div>
        <p className="text-sm font-medium text-muted">{t('inbox.eyebrow')}</p>
        <h1 className="mt-1 font-display text-3xl leading-tight font-semibold text-ink sm:text-4xl">
          {t('inbox.tagline')}
        </h1>
        <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-muted">{t('inbox.lead')}</p>
      </div>
      <ol aria-label={t('inbox.steps.label')} className="grid grid-cols-3 gap-2 sm:gap-3">
        {steps.map((step, index) => (
          <li key={step.key}>
            <BubbleCard tone={index === 0 ? 'tint' : 'panel'} padding="sm" className="h-full">
              <div className="flex items-center gap-2">
                <span className="grid size-8 place-items-center rounded-bubble-sm bg-primary text-on-primary [&_svg]:size-4">
                  {step.icon}
                </span>
                <span className="tabular text-xs font-semibold text-muted">{index + 1}</span>
              </div>
              <p className="mt-2 text-[13px] leading-snug font-semibold text-ink sm:text-sm">{t(`inbox.steps.${step.key}.title`)}</p>
              <p className="mt-0.5 hidden text-[13px] leading-snug text-muted sm:block">{t(`inbox.steps.${step.key}.description`)}</p>
            </BubbleCard>
          </li>
        ))}
      </ol>
    </section>
  )
}

/* -------------------------------------------------------- persona picker */

export function PersonaPicker({
  recipients,
  selectedId,
  meAccountId,
  unread,
  onSelect,
}: {
  recipients: RecipientSummary[]
  selectedId: string
  meAccountId: string | null
  unread: Set<string>
  onSelect: (id: string) => void
}) {
  const { t } = useTranslation('launcher')
  const lang = useLang()
  return (
    <ul className="-mx-4 flex snap-x gap-2 overflow-x-auto px-4 pb-1 lg:mx-0 lg:flex-col lg:overflow-visible lg:px-0 lg:pb-0">
      {recipients.map((recipient) => {
        const selected = recipient.id === selectedId
        const name = lt(recipient.name, lang)
        const isMe = Boolean(meAccountId && recipient.accountId === meAccountId)
        return (
          <li key={recipient.id} className="w-[min(78vw,260px)] shrink-0 snap-start lg:w-auto">
            <button
              type="button"
              onClick={() => onSelect(recipient.id)}
              aria-pressed={selected}
              className={cn(
                'flex w-full items-center gap-3 rounded-2xl border px-3 py-2.5 text-left transition-[background-color,border-color] duration-200 ease-azri focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
                selected
                  ? 'border-primary bg-primary-soft text-on-primary-soft'
                  : 'border-border bg-panel hover:border-border-strong hover:bg-panel-2',
              )}
            >
              <span className="relative">
                <Avatar name={name} color={recipient.avatarColor} size="md" />
                {unread.has(recipient.id) && (
                  <span className="absolute -top-0.5 -right-0.5 grid size-3 place-items-center rounded-full bg-panel">
                    <LiveDot tone="primary" />
                    <span className="sr-only">{t('inbox.personas.newSms')}</span>
                  </span>
                )}
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1.5">
                  <span className="truncate text-sm font-semibold text-ink">{name}</span>
                  {isMe && (
                    <Badge size="sm" tone="accent">
                      {t('inbox.personas.you')}
                    </Badge>
                  )}
                </span>
                <span className="mt-0.5 flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
                  <span className="font-mono text-xs text-muted tabular">{recipient.phoneMasked}</span>
                  <Badge size="sm" tone={recipient.counts.pending > 0 ? 'primary' : 'neutral'}>
                    {recipient.counts.pending > 0
                      ? t('inbox.personas.pending', { count: recipient.counts.pending })
                      : t('inbox.personas.noPending')}
                  </Badge>
                </span>
              </span>
            </button>
          </li>
        )
      })}
    </ul>
  )
}

export function PersonaPickerSkeleton() {
  return (
    <div className="flex gap-2 overflow-hidden lg:flex-col">
      {Array.from({ length: 6 }, (_, index) => (
        <Skeleton key={index} className="h-[60px] w-[240px] shrink-0 rounded-2xl lg:w-full" />
      ))}
    </div>
  )
}

/* ------------------------------------------------------------ SMS bubble */

function BodyWithLink({ body, shortLink }: { body: string; shortLink: string }) {
  const at = shortLink ? body.lastIndexOf(shortLink) : -1
  if (at < 0) return <>{body}</>
  return (
    <>
      {body.slice(0, at)}
      <span className="font-mono text-[0.9em] break-all text-link">{shortLink}</span>
      {body.slice(at + shortLink.length)}
    </>
  )
}

function statusDetail(message: InboxMessage, t: (key: string, options?: Record<string, unknown>) => string, lang: 'en' | 'ka') {
  const now = clock.now()
  switch (message.linkStatus) {
    case 'pending': {
      if (!message.expiresAt) return undefined
      const days = daysUntil(message.expiresAt, now) ?? 0
      return days <= 0 ? t('inbox.message.expiresToday') : t('inbox.message.expiresIn', { count: days })
    }
    case 'completed':
      return message.completedAt
        ? t('inbox.message.answered', { when: formatRelative(message.completedAt, lang, now) })
        : undefined
    case 'expired':
      return message.expiresAt
        ? t('inbox.message.expiredWhen', { when: formatRelative(message.expiresAt, lang, now) })
        : undefined
    default:
      return undefined
  }
}

export function SmsBubble({
  message,
  fresh,
  highlighted,
  onOpen,
}: {
  message: InboxMessage
  fresh: boolean
  highlighted: boolean
  onOpen: (href: string) => void
}) {
  const { t } = useTranslation('launcher')
  const lang = useLang()
  const detail = statusDetail(message, t, lang)
  const actionable = message.linkStatus === 'pending'
  return (
    <motion.li
      id={`sms-${message.id}`}
      layout="position"
      initial={fresh ? { opacity: 0, x: 48 } : false}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      className="scroll-mt-24"
    >
      <BubbleCard
        padding="md"
        className={cn(
          'transition-shadow duration-300',
          highlighted && 'ring-2 ring-primary ring-offset-2 ring-offset-surface',
          fresh && 'animate-flash',
        )}
      >
        <div className="flex items-start gap-3">
          <TenantMark
            monogram={message.tenant.monogram}
            primary={message.tenant.primary}
            onPrimary={message.tenant.onPrimary}
            size="sm"
            title={lt(message.tenant.name, lang)}
          />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
              <span className="flex items-center gap-2">
                <span className="font-mono text-sm font-semibold tracking-wide text-ink" title={t('inbox.message.senderLabel')}>
                  {message.sender}
                </span>
                {fresh && (
                  <Badge size="sm" tone="accent" dot>
                    {t('inbox.message.new')}
                  </Badge>
                )}
              </span>
              <time dateTime={message.receivedAt} className="text-xs text-muted tabular">
                {formatRelative(message.receivedAt, lang, clock.now())}
              </time>
            </div>
            {message.campaignTitle && (
              <p className="mt-0.5 truncate text-xs text-muted">{lt(message.campaignTitle, lang)}</p>
            )}
          </div>
        </div>

        <p className="mt-3 text-[15px] leading-relaxed text-ink">
          <BodyWithLink body={lt(message.body, lang)} shortLink={message.shortLink} />
        </p>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <StatusBadge status={message.linkStatus} detail={detail} />
            <span className="font-mono text-xs break-all text-muted">{message.shortLink}</span>
          </div>
          <Button
            size="sm"
            variant={actionable ? 'primary' : 'secondary'}
            rightIcon={<ArrowUpRight {...ICON} />}
            onClick={() => onOpen(message.href)}
          >
            {t('inbox.message.openLink')}
          </Button>
        </div>
        {(message.linkStatus === 'unknown' || message.linkStatus === 'missing') && (
          <p className="mt-2 text-xs text-muted">
            {t(message.linkStatus === 'unknown' ? 'inbox.message.unknownHint' : 'inbox.message.missingHint')}
          </p>
        )}
      </BubbleCard>
    </motion.li>
  )
}

export function ThreadSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 3 }, (_, index) => (
        <Skeleton key={index} className="h-[168px] w-full rounded-bubble" />
      ))}
    </div>
  )
}

/* -------------------------------------------------------- branch strip */

const BRANCH_ICONS: Record<BranchKind, ReactNode> = {
  valid: <Link2 {...ICON} />,
  completed: <CheckCheck {...ICON} />,
  expired: <Clock3 {...ICON} />,
  unknown: <Link2Off {...ICON} />,
  missing: <CircleSlash {...ICON} />,
}

export function BranchStrip({
  samples,
  loading,
  onOpen,
}: {
  samples: BranchSample[] | undefined
  loading: boolean
  onOpen: (href: string) => void
}) {
  const { t } = useTranslation('launcher')
  return (
    <section aria-labelledby="branch-strip-title" className="rounded-2xl border border-border bg-panel p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 id="branch-strip-title" className="font-display text-lg font-semibold text-ink">
          {t('inbox.branches.title')}
        </h2>
        <p className="text-[13px] text-muted">{t('inbox.branches.description')}</p>
      </div>
      <div className="-mx-4 mt-3 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0">
        {loading || !samples
          ? Array.from({ length: 5 }, (_, index) => <Skeleton key={index} className="h-9 w-36 shrink-0 rounded-full" />)
          : samples.map((sample) => (
              <Chip
                key={sample.kind}
                icon={BRANCH_ICONS[sample.kind]}
                disabled={!sample.href}
                onClick={() => sample.href && onOpen(sample.href)}
              >
                {t(`inbox.branches.kinds.${sample.kind}`)}
                <span className="font-mono text-xs text-muted">
                  {sample.href ? (sample.surveyId ?? '?id=') : t('inbox.branches.none')}
                </span>
              </Chip>
            ))}
      </div>
    </section>
  )
}

/* --------------------------------------------------------- tenant chips */

export function TenantChips({
  tenants,
  pendingByTenant,
  onPick,
}: {
  tenants: Tenant[]
  pendingByTenant: Map<string, number>
  onPick: (tenant: Tenant) => void
}) {
  const { t } = useTranslation('launcher')
  const lang = useLang()
  return (
    <div>
      <h2 className="text-sm font-semibold text-ink">{t('inbox.tenants.title')}</h2>
      <p className="mt-0.5 text-[13px] text-muted">{t('inbox.tenants.description')}</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {tenants.map((tenant) => (
          <Chip
            key={tenant.id}
            size="sm"
            onClick={() => onPick(tenant)}
            icon={<TenantMark monogram={tenant.monogram} primary={tenant.primary} onPrimary={tenant.onPrimary} size="xs" />}
            count={pendingByTenant.get(tenant.id) ?? 0}
            style={{ borderColor: tenant.primary }}
          >
            {lt(tenant.name, lang)}
          </Chip>
        ))}
      </div>
    </div>
  )
}
