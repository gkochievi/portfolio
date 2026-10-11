import { useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Inbox, Layers, List, RefreshCw, Users } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { MailStatusChip } from '@/components/status'
import {
  Button,
  type Column,
  DataTable,
  DateText,
  FilterBar,
  IconButton,
  Input,
  PageHeader,
  Pagination,
  SearchInput,
  SegmentedControl,
  Select,
  SelectItem,
  toast,
  Tooltip,
} from '@/components/ui'
import { cn } from '@/lib/cn'
import { formatRelative } from '@/lib/format'
import { useStaffMe } from '@/lib/session'
import type { MailStatus } from '@/types'

import { errorMessage, type InboxFilters, type MailRow, type ThreadRow, useMails, usePollNow, useThreads } from '../api'
import { PaperclipMark } from '../components/AttachmentList'
import { useFreshIds } from '../lib/useFreshIds'

const STATUSES: MailStatus[] = ['new', 'triaged', 'task_created', 'followup', 'ignored']
type View = 'threads' | 'flat'

function Preview({ from, when, text, children }: { from: string; when: string; text: string; children: React.ReactElement }) {
  return (
    <Tooltip
      side="bottom"
      content={
        <div className="max-w-[300px] space-y-1">
          <div className="flex items-baseline justify-between gap-3">
            <span className="font-medium">{from}</span>
            <span className="num shrink-0 opacity-70">{when}</span>
          </div>
          <div className="line-clamp-4 whitespace-pre-line opacity-90">{text}</div>
        </div>
      }
    >
      {children}
    </Tooltip>
  )
}

export default function MailsPage() {
  const { t } = useTranslation(['support-desk', 'common'])
  const me = useStaffMe()
  const [params, setParams] = useSearchParams()

  const view: View = params.get('view') === 'flat' ? 'flat' : 'threads'
  const status = (STATUSES as string[]).includes(params.get('status') ?? '') ? (params.get('status') as MailStatus) : ''
  const q = params.get('q') ?? ''
  const from = params.get('from') ?? ''
  const since = params.get('since') ?? ''
  const sortKey = params.get('sort') ?? (view === 'flat' ? 'receivedAt' : 'lastMessageAt')
  const dir: 'asc' | 'desc' = params.get('dir') === 'asc' ? 'asc' : params.get('dir') === 'desc' ? 'desc' : sortKey === 'subject' || sortKey === 'from' ? 'asc' : 'desc'
  const page = Math.max(1, Number(params.get('page')) || 1)

  const filters: InboxFilters = { status, q, from, since, sort: sortKey, dir, page }
  const threads = useThreads(filters, view === 'threads')
  const mails = useMails(filters, view === 'flat')
  const active = view === 'threads' ? threads : mails
  const poll = usePollNow()

  const update = (patch: Record<string, string | null>, resetPage = true) => {
    const next = new URLSearchParams(params)
    for (const [k, v] of Object.entries(patch)) {
      if (v === null || v === '') next.delete(k)
      else next.set(k, v)
    }
    if (resetPage) next.delete('page')
    setParams(next, { replace: true })
  }

  const resetKey = `${view}|${status}|${q}|${from}|${since}|${sortKey}|${dir}|${page}`
  const fresh = useFreshIds(active.data?.rows.map((r) => r.id), resetKey)
  const hasFilters = Boolean(status || q || from || since)

  const rowClass = (r: { id: string; status: MailStatus }) =>
    cn(r.status === 'new' && 'serving', fresh.has(r.id) && 'animate-rise')

  const threadColumns = useMemo<Column<ThreadRow>[]>(
    () => [
      {
        key: 'subject',
        header: t('inbox.cols.subject'),
        sortable: true,
        cell: (r) => (
          <Preview from={r.latestFromName || r.latestFromAddr} when={formatRelative(r.lastMessageAt)} text={r.preview}>
            <div className="min-w-0 max-w-[560px]">
              <div className="flex items-center gap-1.5">
                <span className={cn('truncate text-ink', r.status === 'new' ? 'font-semibold' : 'font-medium')}>{r.subject}</span>
                {r.hasAttachments ? <PaperclipMark label={t('inbox.hasAttachments')} /> : null}
              </div>
              <div className="truncate text-xs text-muted">{r.preview}</div>
            </div>
          </Preview>
        ),
      },
      {
        key: 'from',
        header: t('inbox.cols.latestFrom'),
        sortable: true,
        hideBelow: 'md',
        cell: (r) => (
          <div className="min-w-0">
            <div className="truncate text-[13px] text-ink">{r.latestFromName || r.latestFromAddr}</div>
            {r.partnerName ? <div className="truncate text-xs text-muted">{r.partnerName}</div> : null}
          </div>
        ),
      },
      {
        key: 'participants',
        header: <Users className="size-3.5 stroke-[1.75]" aria-label={t('inbox.cols.participants')} />,
        align: 'right',
        hideBelow: 'lg',
        width: 56,
        cell: (r) => <span className="num text-[13px] text-muted">{r.participantCount}</span>,
      },
      {
        key: 'messageCount',
        header: t('inbox.cols.messages'),
        sortable: true,
        align: 'right',
        hideBelow: 'sm',
        width: 84,
        cell: (r) => <span className="num text-[13px] text-ink">{r.messageCount}</span>,
      },
      {
        key: 'lastMessageAt',
        header: t('inbox.cols.lastActivity'),
        sortable: true,
        hideBelow: 'sm',
        width: 140,
        cell: (r) => <DateText value={r.lastMessageAt} relative withTime />,
      },
      { key: 'status', header: t('common:fields.status'), sortable: true, width: 130, cell: (r) => <MailStatusChip status={r.status} /> },
    ],
    [t],
  )

  const flatColumns = useMemo<Column<MailRow>[]>(
    () => [
      {
        key: 'subject',
        header: t('inbox.cols.subject'),
        sortable: true,
        cell: (r) => (
          <Preview from={r.fromName || r.fromAddr} when={formatRelative(r.receivedAt)} text={r.preview}>
            <div className="min-w-0 max-w-[560px]">
              <div className="flex items-center gap-1.5">
                <span className={cn('truncate text-ink', r.status === 'new' ? 'font-semibold' : 'font-medium')}>{r.subject}</span>
                {r.hasAttachments ? <PaperclipMark label={t('inbox.hasAttachments')} /> : null}
              </div>
              <div className="truncate text-xs text-muted">{r.preview}</div>
            </div>
          </Preview>
        ),
      },
      {
        key: 'from',
        header: t('inbox.cols.from'),
        sortable: true,
        hideBelow: 'md',
        cell: (r) => (
          <div className="min-w-0">
            <div className="truncate text-[13px] text-ink">{r.fromName || r.fromAddr}</div>
            <div className="truncate font-mono text-xs text-muted">{r.fromAddr}</div>
          </div>
        ),
      },
      {
        key: 'receivedAt',
        header: t('inbox.cols.received'),
        sortable: true,
        hideBelow: 'sm',
        width: 140,
        cell: (r) => <DateText value={r.receivedAt} relative withTime />,
      },
      { key: 'status', header: t('common:fields.status'), sortable: true, width: 130, cell: (r) => <MailStatusChip status={r.status} /> },
    ],
    [t],
  )

  const onPoll = () =>
    poll.mutate(undefined, {
      onSuccess: (r) =>
        r.ingested + r.skipped === 0
          ? toast.info(t('poll.nothing'), { description: t('poll.remaining', { count: r.remaining }) })
          : toast.success(t('poll.done', { ingested: r.ingested, skipped: r.skipped, remaining: r.remaining })),
      onError: (e) => toast.error(errorMessage(e)),
    })

  const sort = { key: sortKey, dir }
  const onSortChange = (s: { key: string; dir: 'asc' | 'desc' }) => update({ sort: s.key, dir: s.dir })
  const empty = hasFilters
    ? { title: t('inbox.emptyFiltered'), description: t('inbox.emptyFilteredHint') }
    : { title: t('inbox.empty'), description: t('inbox.emptyHint') }

  return (
    <>
      <PageHeader
        eyebrow={t('inbox.eyebrow')}
        title={t('inbox.title')}
        description={t('inbox.description')}
        icon={<Inbox />}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <SegmentedControl
              aria-label={t('inbox.view')}
              value={view}
              onChange={(v) => update({ view: v === 'threads' ? null : v, sort: null, dir: null })}
              options={[
                { value: 'threads', label: t('inbox.threads'), icon: <Layers /> },
                { value: 'flat', label: t('inbox.flat'), icon: <List /> },
              ]}
            />
            <IconButton
              label={t('common:actions.refresh')}
              icon={<RefreshCw className={active.isFetching ? 'animate-spin' : undefined} />}
              variant="outline"
              onClick={() => void active.refetch()}
            />
            {me?.role === 'superadmin' ? (
              <Button variant="primary" icon={<Inbox />} loading={poll.isPending} onClick={onPoll}>
                {t('poll.button')}
              </Button>
            ) : null}
          </div>
        }
      />

      <FilterBar onClear={hasFilters ? () => update({ status: null, q: null, from: null, since: null }) : undefined}>
        <div className="w-full sm:w-64">
          <SearchInput value={q} onChange={(v) => update({ q: v })} placeholder={t('inbox.searchPlaceholder')} />
        </div>
        <div className="w-full sm:w-44">
          <Select aria-label={t('common:fields.status')} value={status || 'all'} onValueChange={(v) => update({ status: v === 'all' ? null : v })}>
            <SelectItem value="all">{t('inbox.anyStatus')}</SelectItem>
            {STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {t(`common:mailStatus.${s}`)}
              </SelectItem>
            ))}
          </Select>
        </div>
        <div className="w-full sm:w-52">
          <SearchInput value={from} onChange={(v) => update({ from: v })} placeholder={t('inbox.fromFilter')} className="sm:w-52" />
        </div>
        <div className="flex w-full items-center gap-2 sm:w-auto">
          <span className="text-xs text-muted">{t('inbox.since')}</span>
          <Input type="date" aria-label={t('inbox.since')} value={since} onChange={(e) => update({ since: e.target.value })} className="w-40" />
        </div>
      </FilterBar>

      {view === 'threads' ? (
        <DataTable<ThreadRow>
          columns={threadColumns}
          rows={threads.data?.rows}
          getRowId={(r) => r.id}
          loading={threads.isPending}
          error={threads.isError ? threads.error : undefined}
          onRetry={() => void threads.refetch()}
          rowHref={(r) => `/l1/threads/${r.id}`}
          rowClassName={rowClass}
          sort={sort}
          onSortChange={onSortChange}
          pageSize={0}
          empty={empty}
          caption={t('inbox.title')}
        />
      ) : (
        <DataTable<MailRow>
          columns={flatColumns}
          rows={mails.data?.rows}
          getRowId={(r) => r.id}
          loading={mails.isPending}
          error={mails.isError ? mails.error : undefined}
          onRetry={() => void mails.refetch()}
          rowHref={(r) => `/l1/mails/${r.id}`}
          rowClassName={rowClass}
          sort={sort}
          onSortChange={onSortChange}
          pageSize={0}
          empty={empty}
          caption={t('inbox.title')}
        />
      )}

      {active.data && active.data.total > active.data.pageSize ? (
        <div className="mt-3">
          <Pagination
            page={active.data.page}
            pageSize={active.data.pageSize}
            total={active.data.total}
            onPageChange={(p) => update({ page: p === 1 ? null : String(p) }, false)}
          />
        </div>
      ) : null}
    </>
  )
}
