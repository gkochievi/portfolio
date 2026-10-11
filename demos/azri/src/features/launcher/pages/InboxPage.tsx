/**
 * SMS inbox launcher (/). Six recipient personas, their texts with live link
 * statuses, a "try every branch" strip and tenant shortcuts. Owner: launcher.
 * The `/?id=` redirect to the survey happens earlier, in routes.tsx (EntryGate).
 */
import { useSession } from '@portfolio/demo-kit'
import { AnimatePresence } from 'framer-motion'
import { Info, LogIn, Terminal } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'

import { EmptyState, ErrorState, toast } from '@/components/ui'
import { bus } from '@/demo/core'
import { session } from '@/demo/session'
import { useLang } from '@/hooks/useLang'
import { useMeta } from '@/hooks/useMeta'
import { lt } from '@/lib/utils'
import type { Tenant } from '@/types'

import { useAllInboxes, useBranches, useInbox, useRecipients } from '../api'
import {
  BranchStrip,
  InboxHero,
  PersonaPicker,
  PersonaPickerSkeleton,
  SmsBubble,
  TenantChips,
  ThreadSkeleton,
} from '../components/inbox'

const DEFAULT_RECIPIENT = 'rcp_mariam'
const ICON = { size: 20, strokeWidth: 1.75 } as const

export default function InboxPage() {
  const { t } = useTranslation('launcher')
  const lang = useLang()
  const navigate = useNavigate()
  const me = useSession(session)
  const [searchParams, setSearchParams] = useSearchParams()

  const recipientsQuery = useRecipients()
  const meta = useMeta()
  const branches = useBranches()
  const recipients = useMemo(() => recipientsQuery.data ?? [], [recipientsQuery.data])

  /* Selection: ?recipient=, then the signed-in respondent, then Mariam. */
  const param = searchParams.get('recipient')
  const candidates = [param, me?.recipientId ?? null, DEFAULT_RECIPIENT].filter((id): id is string => Boolean(id))
  const selectedId =
    recipients.length > 0
      ? (candidates.find((id) => recipients.some((recipient) => recipient.id === id)) ?? recipients[0]!.id)
      : (candidates[0] ?? DEFAULT_RECIPIENT)
  const selected = recipients.find((recipient) => recipient.id === selectedId)

  const thread = useInbox(selectedId)
  const allInboxes = useAllInboxes(recipients.map((recipient) => recipient.id))

  const [unread, setUnread] = useState<Set<string>>(() => new Set())
  const [fresh, setFresh] = useState<Set<string>>(() => new Set())
  const [highlightId, setHighlightId] = useState<string | null>(null)

  const select = useCallback(
    (id: string) => {
      setSearchParams(
        (previous) => {
          const next = new URLSearchParams(previous)
          next.set('recipient', id)
          return next
        },
        { replace: true },
      )
      setUnread((previous) => {
        if (!previous.has(id)) return previous
        const next = new Set(previous)
        next.delete(id)
        return next
      })
    },
    [setSearchParams],
  )

  // Opening a persona clears its "new SMS" dot.
  useEffect(() => {
    setUnread((previous) => {
      if (!previous.has(selectedId)) return previous
      const next = new Set(previous)
      next.delete(selectedId)
      return next
    })
  }, [selectedId])

  /* Live: a new SMS slides into the open thread, or dots another persona. */
  const live = useRef({ selectedId, recipients, tenants: meta.data?.tenants ?? [], lang, t, select })
  live.current = { selectedId, recipients, tenants: meta.data?.tenants ?? [], lang, t, select }

  useEffect(
    () =>
      bus.on('sms:received', ({ messageId, recipientId, tenantId }) => {
        const current = live.current
        const tenant = current.tenants.find((item) => item.id === tenantId)
        const sender = tenant?.smsSender ?? ''
        if (recipientId === current.selectedId) {
          setFresh((previous) => new Set(previous).add(messageId))
          toast.success(current.t('inbox.toast.newSms', { sender }))
        } else {
          setUnread((previous) => new Set(previous).add(recipientId))
          const person = current.recipients.find((item) => item.id === recipientId)
          toast(
            current.t('inbox.toast.forOther', { name: person ? lt(person.name, current.lang) : recipientId, sender }),
            { action: { label: current.t('inbox.toast.show'), onClick: () => live.current.select(recipientId) } },
          )
        }
      }),
    [],
  )

  // Fresh badges fade after a while.
  useEffect(() => {
    if (fresh.size === 0) return
    const timer = window.setTimeout(() => setFresh(new Set()), 12_000)
    return () => window.clearTimeout(timer)
  }, [fresh])

  /* Tenant chips: jump to the first persona with a pending text from that tenant. */
  const pendingByTenant = useMemo(() => {
    const counts = new Map<string, number>()
    for (const message of allInboxes.messages) {
      if (message.linkStatus === 'pending') counts.set(message.tenantId, (counts.get(message.tenantId) ?? 0) + 1)
    }
    return counts
  }, [allInboxes.messages])

  const pickTenant = (tenant: Tenant) => {
    const tenantName = lt(tenant.name, lang)
    for (const recipient of recipients) {
      const hit = allInboxes.messages.find(
        (message) =>
          message.recipientId === recipient.id && message.tenantId === tenant.id && message.linkStatus === 'pending',
      )
      if (hit) {
        select(recipient.id)
        setHighlightId(hit.id)
        toast(t('inbox.tenants.jumped', { name: lt(recipient.name, lang), tenant: tenantName }))
        return
      }
    }
    toast(t('inbox.tenants.noPending', { name: tenantName }))
  }

  useEffect(() => {
    if (!highlightId) return
    const timer = window.setTimeout(() => setHighlightId(null), 2600)
    return () => window.clearTimeout(timer)
  }, [highlightId])

  useEffect(() => {
    if (!highlightId || !thread.data?.some((message) => message.id === highlightId)) return
    document.getElementById(`sms-${highlightId}`)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [highlightId, thread.data])

  const open = (href: string) => navigate(href)
  const selectedName = selected ? lt(selected.name, lang) : ''

  return (
    <div className="min-w-0 space-y-8">
      <InboxHero />

      <BranchStrip samples={branches.data} loading={branches.isLoading} onOpen={open} />

      <div className="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[300px_minmax(0,1fr)] lg:items-start">
        <aside className="min-w-0 space-y-5 lg:sticky lg:top-20">
          <div>
            <h2 className="font-display text-lg font-semibold text-ink">{t('inbox.personas.title')}</h2>
            <p className="mt-0.5 mb-3 text-[13px] text-muted">{t('inbox.personas.description')}</p>
            {recipientsQuery.isError ? (
              <ErrorState compact description={t('inbox.personas.error')} onRetry={() => void recipientsQuery.refetch()} />
            ) : recipientsQuery.isLoading ? (
              <PersonaPickerSkeleton />
            ) : (
              <PersonaPicker
                recipients={recipients}
                selectedId={selectedId}
                meAccountId={me?.id ?? null}
                unread={unread}
                onSelect={select}
              />
            )}
          </div>
          {meta.data && (
            <TenantChips tenants={meta.data.tenants} pendingByTenant={pendingByTenant} onPick={pickTenant} />
          )}
        </aside>

        <section aria-labelledby="thread-title" aria-live="polite" className="min-w-0">
          <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
            <h2 id="thread-title" className="font-display text-lg font-semibold text-ink">
              {selectedName ? t('inbox.thread.title', { name: selectedName }) : ' '}
            </h2>
            {thread.data && (
              <span className="text-xs text-muted tabular">{t('inbox.thread.count', { count: thread.data.length })}</span>
            )}
          </div>
          {thread.isError ? (
            <ErrorState description={t('inbox.thread.error')} onRetry={() => void thread.refetch()} />
          ) : thread.isLoading || !thread.data ? (
            <ThreadSkeleton />
          ) : thread.data.length === 0 ? (
            <EmptyState
              framed
              illustration="inbox"
              title={t('inbox.thread.emptyTitle')}
              description={t('inbox.thread.emptyDescription')}
            />
          ) : (
            <ul className="space-y-3">
              <AnimatePresence initial={false}>
                {thread.data.map((message) => (
                  <SmsBubble
                    key={message.id}
                    message={message}
                    fresh={fresh.has(message.id)}
                    highlighted={highlightId === message.id}
                    onOpen={open}
                  />
                ))}
              </AnimatePresence>
            </ul>
          )}
        </section>
      </div>

      <footer className="flex flex-col gap-3 border-t border-border pt-5 text-sm sm:flex-row sm:items-center sm:justify-between">
        <p className="flex items-center gap-2 text-muted">
          <Info {...ICON} className="size-4 shrink-0" />
          {t('inbox.footer.reset')}
        </p>
        <nav className="flex flex-wrap gap-x-5 gap-y-2">
          <Link to="/playground" className="inline-flex items-center gap-1.5 font-medium text-link hover:underline">
            <Terminal {...ICON} className="size-4" />
            {t('inbox.footer.playground')}
          </Link>
          <Link to="/login" className="inline-flex items-center gap-1.5 font-medium text-link hover:underline">
            <LogIn {...ICON} className="size-4" />
            {t('inbox.footer.signIn')}
          </Link>
        </nav>
      </footer>
    </div>
  )
}
