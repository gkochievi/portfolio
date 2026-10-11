import { ArrowLeft, Bot, Headset, MessageCircle, ShieldCheck, ShieldQuestion } from 'lucide-react'
import { Link, useLocation, useParams } from 'react-router-dom'

import { isApiError } from '@/api/client'
import { Badge, Button, Callout, EmptyState, PageHeader, Panel, Skeleton, StatTile } from '@/components/ui'
import { formatDateTime, formatNumber, formatTokens } from '@/lib/format'
import { cn } from '@/lib/cn'
import { useConversation } from '../api'
import { CallsTable, useLabels } from '../components/parts'
import type { UsageConversationTurn } from '../types'
import { stateTone } from './UsageConversationsPage'

const roleIcon = { customer: MessageCircle, bot: Bot, operator: Headset } as const
const roleTone = { customer: 'neutral', bot: 'primary', operator: 'accent' } as const

function TurnCard({ turn }: { turn: UsageConversationTurn }) {
  const L = useLabels()
  const { t, lang } = L
  const Icon = roleIcon[turn.role]
  const answering = turn.role !== 'customer'
  return (
    <li className={cn('rounded-card border border-line bg-panel p-3.5', turn.role === 'customer' && 'bg-sunken/50')}>
      <div className="flex flex-wrap items-center gap-2 text-[12px]">
        <Badge tone={roleTone[turn.role]} size="sm" icon={<Icon className="size-3" />}>{L.role(turn.role)}</Badge>
        <time dateTime={turn.created_at} className="tabular text-muted">{formatDateTime(turn.created_at, lang)}</time>
        {answering && turn.grounded != null ? (
          turn.grounded ? (
            <Badge tone="success" size="sm" icon={<ShieldCheck className="size-3" />}>{t('conversation.grounded')}</Badge>
          ) : (
            <Badge tone="warning" size="sm" icon={<ShieldQuestion className="size-3" />}>{t('conversation.ungrounded')}</Badge>
          )
        ) : null}
        {answering && turn.method && turn.method !== 'none' ? <span className="font-mono text-muted">{turn.method}</span> : null}
        {answering && turn.top_score != null ? <span className="tabular font-mono text-muted">{t('conversation.score', { n: turn.top_score.toFixed(2) })}</span> : null}
        <span className="tabular ml-auto font-mono text-muted">{turn.tokens > 0 ? t('conversation.turnTokens', { n: formatNumber(turn.tokens, lang) }) : t('conversation.noTokens')}</span>
      </div>
      <p className="mt-2 whitespace-pre-wrap text-[14px] leading-relaxed">{turn.content}</p>
      {turn.calls.length > 0 ? (
        <div className="mt-3 overflow-hidden rounded-ctl border border-line">
          <CallsTable rows={turn.calls} compact bare />
        </div>
      ) : null}
    </li>
  )
}

/** One conversation's AI usage: turns with grounded flags, and the calls behind each. */
export default function UsageConversationDetailPage() {
  const { conversationId = '' } = useParams()
  const L = useLabels()
  const { t, lang } = L
  const state = useLocation().state as { search?: string } | null
  const back = `/usage/conversations${state?.search ?? ''}`
  const query = useConversation(conversationId)
  const data = query.data

  const backLink = (
    <Link to={back} className="inline-flex items-center gap-1.5 text-[13px] text-muted hover:text-ink">
      <ArrowLeft className="size-4" strokeWidth={1.75} aria-hidden />
      {t('conversation.back')}
    </Link>
  )

  if (query.isError) {
    const missing = isApiError(query.error) && query.error.status === 404
    return (
      <div>
        {backLink}
        <div className="mt-6">
          <EmptyState title={missing ? t('conversation.notFound') : t('error.title')} body={missing ? t('conversation.notFoundBody') : t('error.body')} action={<Button asChild><Link to={back}>{t('conversation.back')}</Link></Button>} />
        </div>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="space-y-4" aria-busy="true">
        {backLink}
        <Skeleton className="h-16" />
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-[92px]" />)}</div>
        <Skeleton className="h-[320px]" />
      </div>
    )
  }

  const { conversation: c, totals } = data
  const groundedAnswers = data.turns.filter((x) => x.role !== 'customer' && x.grounded === true).length
  const answers = data.turns.filter((x) => x.role !== 'customer' && x.grounded != null).length

  return (
    <div className="space-y-6">
      <PageHeader
        back={backLink}
        title={c.subject}
        description={t('conversation.description')}
        meta={
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="neutral">{L.workspace(c)}</Badge>
            <Badge tone="neutral">{L.channel(c.channel)}</Badge>
            <Badge tone={stateTone[c.state]}>{L.state(c.state)}</Badge>
            <Badge tone="neutral">{L.mode(c.mode)}</Badge>
          </div>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label={t('tiles.total')} value={formatTokens(totals.total, lang)} hint={t('tiles.totalHint', { n: formatNumber(totals.total, lang) })} />
        <StatTile label={t('tiles.calls')} value={formatNumber(totals.calls, lang)} hint={totals.failed ? t('recording.failedHint', { n: totals.failed }) : t('recording.allOk')} tone={totals.failed ? 'danger' : undefined} />
        <StatTile label={t('conversations.cols.turns')} value={formatNumber(c.turns, lang)} hint={t('conversation.questionsHint', { n: c.questions })} />
        <StatTile label={t('conversation.groundedAnswers')} value={`${groundedAnswers}/${answers}`} hint={t('conversation.groundedHint')} />
      </div>

      {data.features.length > 0 ? (
        <Panel title={t('conversation.byFeature')}>
          <ul className="grid gap-x-8 gap-y-2 sm:grid-cols-2 lg:grid-cols-4">
            {data.features.map((f) => (
              <li key={f.feature} className="flex items-baseline justify-between gap-3 border-b border-line py-1.5 text-[13px]">
                <span>{L.feature(f.feature)}</span>
                <span className="tabular font-mono text-[12.5px]">
                  {formatTokens(f.tokens, lang)} <span className="text-muted">/ {t('conversation.callsShort', { n: f.calls })}</span>
                </span>
              </li>
            ))}
          </ul>
        </Panel>
      ) : null}

      <section aria-labelledby="usage-turns">
        <h2 id="usage-turns" className="mb-3 text-[15px] font-semibold">{t('conversation.turns')}</h2>
        {data.turns.length === 0 ? <EmptyState compact title={t('conversation.noTurns')} /> : <ol className="space-y-3">{data.turns.map((turn) => <TurnCard key={turn.id} turn={turn} />)}</ol>}
      </section>

      {data.extra_calls.length > 0 ? (
        <Panel title={t('conversation.extraCalls')} description={t('conversation.extraCallsDescription')} flush>
          <CallsTable rows={data.extra_calls} compact bare />
        </Panel>
      ) : null}

      {c.state === 'handoff' ? <Callout tone="info" title={t('conversation.handoffTitle')}>{t('conversation.handoffBody')}</Callout> : null}
    </div>
  )
}
