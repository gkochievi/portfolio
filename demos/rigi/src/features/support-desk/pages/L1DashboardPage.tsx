import { Link } from 'react-router-dom'
import { ArrowRight, FolderKanban, Inbox, ListChecks, MailPlus, MessageSquareDot, Plus } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { MailStatusChip } from '@/components/status'
import {
  Banner,
  Button,
  Card,
  CardBody,
  CardHeader,
  DateText,
  EmptyState,
  KpiStrip,
  KpiTile,
  PageHeader,
  Skeleton,
} from '@/components/ui'
import { cn } from '@/lib/cn'
import { formatNumber, localName } from '@/lib/format'
import { useStaffMe } from '@/lib/session'

import { type ThreadRow, useL1Dashboard } from '../api'
import { PaperclipMark } from '../components/AttachmentList'

function QuickCard({ to, icon, title, hint, value, tone }: { to: string; icon: React.ReactNode; title: string; hint: string; value?: number; tone?: 'accent' }) {
  return (
    <Link
      to={to}
      className="group flex items-start gap-3 rounded-lg border border-hairline bg-panel p-4 transition-colors duration-150 ease-rigi hover:border-hairline-strong hover:bg-row-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal"
    >
      <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md bg-sunken text-ink [&_svg]:size-4 [&_svg]:stroke-[1.75]">{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2 font-display text-[15px] font-semibold text-ink">
          {title}
          {value !== undefined && value > 0 ? (
            <span className={cn('num rounded px-1.5 py-0.5 text-xs font-medium', tone === 'accent' ? 'bg-accent/12 text-accent' : 'bg-sunken text-muted')}>{formatNumber(value)}</span>
          ) : null}
        </span>
        <span className="mt-0.5 block text-[13px] text-muted">{hint}</span>
      </span>
      <ArrowRight className="mt-1 size-4 shrink-0 stroke-[1.75] text-subtle transition-transform duration-150 ease-rigi group-hover:translate-x-0.5" aria-hidden />
    </Link>
  )
}

function NextUpRow({ thread, first }: { thread: ThreadRow; first: boolean }) {
  const { t } = useTranslation(['support-desk', 'common'])
  return (
    <li>
      <Link
        to={`/l1/threads/${thread.id}`}
        className={cn(
          'flex items-start gap-3 px-4 py-3 transition-colors duration-150 ease-rigi hover:bg-row-hover focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-signal',
          first && 'serving',
        )}
      >
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="truncate text-sm font-semibold text-ink">{thread.subject}</span>
            {thread.hasAttachments ? <PaperclipMark label={t('inbox.hasAttachments')} /> : null}
          </div>
          <div className="mt-0.5 truncate text-[13px] text-muted">{thread.preview}</div>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
            <span className="truncate">{thread.latestFromName || thread.latestFromAddr}</span>
            {thread.partnerName ? <span className="truncate">· {thread.partnerName}</span> : null}
            <span className="num">{t('dashboard.messages', { count: thread.messageCount })}</span>
          </div>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1.5">
          <MailStatusChip status={thread.status} />
          <DateText value={thread.firstMessageAt} relative withTime />
        </div>
      </Link>
    </li>
  )
}

export default function L1DashboardPage() {
  const { t } = useTranslation(['support-desk', 'common'])
  const me = useStaffMe()
  const query = useL1Dashboard()
  const data = query.data

  return (
    <>
      <PageHeader
        eyebrow={t('dashboard.eyebrow')}
        title={t('dashboard.title')}
        description={me ? t('dashboard.greeting', { name: localName(me) }) : undefined}
        actions={
          <Button asChild icon={<Plus />}>
            <Link to="/l1/tasks/new">{t('dashboard.newTask')}</Link>
          </Button>
        }
      />

      {query.isError ? (
        <Banner tone="danger" action={<Button size="sm" variant="secondary" onClick={() => void query.refetch()}>{t('common:actions.retry')}</Button>}>
          {t('dashboard.failed')}
        </Banner>
      ) : null}

      <KpiStrip>
        <KpiTile index={1} loading={!data} label={t('dashboard.kpi.newMails')} value={data?.newMails ?? 0} trend={data?.trends.newMails} href="/l1/mails?status=new" hint={t('dashboard.kpi.newMailsHint')} />
        <KpiTile index={2} loading={!data} label={t('dashboard.kpi.triaged')} value={data?.triagedMails ?? 0} trend={data?.trends.triagedMails} href="/l1/mails?status=triaged" hint={t('dashboard.kpi.triagedHint')} />
        <KpiTile index={3} loading={!data} label={t('dashboard.kpi.openTasks')} value={data?.openTasks ?? 0} trend={data?.trends.openTasks} href="/l1/tasks" hint={t('dashboard.kpi.openTasksHint')} />
        <KpiTile index={4} loading={!data} label={t('dashboard.kpi.mine')} value={data?.myAssigned ?? 0} trend={data?.trends.myAssigned} href="/l1/tasks?mine=1" hint={t('dashboard.kpi.mineHint')} />
      </KpiStrip>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <Card>
          <CardHeader
            eyebrow={t('common:states.nextUp')}
            title={t('dashboard.queueTitle')}
            description={t('dashboard.queueDescription')}
            actions={
              <Button asChild variant="ghost" size="sm" iconRight={<ArrowRight />}>
                <Link to="/l1/mails?status=new">{t('dashboard.openInbox')}</Link>
              </Button>
            }
          />
          {!data ? (
            <CardBody className="space-y-3">
              <Skeleton className="h-14 w-full" />
              <Skeleton className="h-14 w-full" />
              <Skeleton className="h-14 w-full" />
            </CardBody>
          ) : data.nextUp.length === 0 ? (
            <CardBody>
              <EmptyState compact title={t('common:states.allCaughtUp')} description={t('dashboard.queueEmpty')} />
            </CardBody>
          ) : (
            <ul className="divide-y divide-hairline border-t border-hairline">
              {data.nextUp.map((thread, i) => (
                <NextUpRow key={thread.id} thread={thread} first={i === 0} />
              ))}
            </ul>
          )}
        </Card>

        <div className="space-y-3">
          <QuickCard to="/l1/mails" icon={<Inbox />} title={t('dashboard.quick.inbox')} hint={t('dashboard.quick.inboxHint', { count: data?.followups ?? 0 })} value={data?.newMails} />
          <QuickCard to="/l1/tasks" icon={<MessageSquareDot />} title={t('dashboard.quick.replies')} hint={t('dashboard.quick.repliesHint')} value={data?.newReplies} tone="accent" />
          <QuickCard to="/l1/tasks/new" icon={<MailPlus />} title={t('dashboard.quick.newTask')} hint={t('dashboard.quick.newTaskHint')} />
          <QuickCard to="/l1/projects" icon={<FolderKanban />} title={t('dashboard.quick.projects')} hint={t('dashboard.quick.projectsHint')} value={data?.openProjects} />
          <QuickCard to="/l1/tasks?mine=1" icon={<ListChecks />} title={t('dashboard.quick.mine')} hint={t('dashboard.quick.mineHint')} value={data?.myAssigned} />
        </div>
      </div>
    </>
  )
}
