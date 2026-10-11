import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'

import { TaskStateChip } from '@/components/status'
import { Badge, Banner, Button, EmptyState, KpiStrip, KpiTile, Mono, PageHeader, Section, Skeleton, TicketCard } from '@/components/ui'
import { formatPoints, formatTaskNumber } from '@/lib/format'

import { type TaskRow, useTechnicianDashboard } from '../api'
import { DeadlineCell } from '../components/TasksTable'

function PlateItem({ task, first }: { task: TaskRow; first: boolean }) {
  const { t } = useTranslation(['tasks', 'common'])
  return (
    <TicketCard
      to={`/technician/tasks/${task.id}`}
      active={first}
      footer={
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
          <span>{task.partnerName ?? t('common:internal')}</span>
          <span className="inline-flex items-center gap-3">
            {task.pricingPending ? <Badge tone="warning">{t('table.pricingPending')}</Badge> : task.points !== null ? <span className="num">{formatPoints(task.points)}</span> : null}
            <DeadlineCell task={task} />
          </span>
        </div>
      }
    >
      <div className="flex flex-wrap items-center gap-2">
        {first ? <Badge tone="primary">{t('common:states.nextUp')}</Badge> : null}
        <Mono chip={false}>{formatTaskNumber(task.number)}</Mono>
        <TaskStateChip state={task.state} />
        {task.hasNewReplies ? <Badge tone="accent">{t('table.newReplies')}</Badge> : null}
      </div>
      <div className="mt-1.5 font-medium">{task.title}</div>
    </TicketCard>
  )
}

/** /technician: "You handle" chip, four KPI tiles and the personal queue. */
export default function TechnicianDashboardPage() {
  const { t } = useTranslation(['tasks', 'common'])
  const query = useTechnicianDashboard()
  const data = query.data

  return (
    <>
      <PageHeader
        eyebrow={t('dashboard.eyebrow')}
        title={t('dashboard.title')}
        meta={
          data ? (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm text-muted">{t('dashboard.youHandle')}</span>
              {data.technicianType ? <Badge tone="primary">{t(`common:technicianType.${data.technicianType}`)}</Badge> : <Badge tone="outline">{t('dashboard.allTypes')}</Badge>}
            </div>
          ) : null
        }
        actions={
          <Button asChild variant="secondary">
            <Link to="/technician/tasks?tab=all">{t('dashboard.allTasks')}</Link>
          </Button>
        }
      />

      {query.isError ? (
        <Banner
          tone="danger"
          title={t('dashboard.loadFailed')}
          action={
            <Button size="sm" variant="secondary" onClick={() => void query.refetch()}>
              {t('common:actions.retry')}
            </Button>
          }
        />
      ) : null}

      <KpiStrip>
        <KpiTile index={1} label={t('dashboard.kpi.myOpen')} value={data?.myOpen ?? 0} loading={!data} trend={data?.trends.myOpen} href="/technician/tasks?tab=mine&state=open" />
        <KpiTile index={2} label={t('dashboard.kpi.finishedThisMonth')} value={data?.finishedThisMonth ?? 0} loading={!data} trend={data?.trends.finishedThisMonth} href="/technician/tasks?tab=mine" />
        <KpiTile
          index={3}
          label={t('dashboard.kpi.unassigned')}
          value={data?.unassigned ?? 0}
          loading={!data}
          trend={data?.trends.unassigned}
          tone={data && data.unassigned > 0 ? 'warning' : 'primary'}
          href="/technician/tasks?tab=unassigned"
        />
        <KpiTile index={4} label={t('dashboard.kpi.allOpen')} value={data?.allOpen ?? 0} loading={!data} trend={data?.trends.allOpen} href="/technician/tasks?tab=all&state=open" />
      </KpiStrip>

      <Section title={t('dashboard.plate')} description={t('dashboard.plateHint')} className="mt-8">
        {!data ? (
          <div className="space-y-3">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
          </div>
        ) : data.plate.length === 0 ? (
          <EmptyState
            title={t('common:states.allCaughtUp')}
            description={t('dashboard.plateEmpty')}
            action={
              <Button asChild variant="secondary">
                <Link to="/technician/tasks?tab=unassigned">{t('dashboard.pickUp')}</Link>
              </Button>
            }
          />
        ) : (
          <div className="space-y-3">
            {data.plate.map((task, i) => (
              <PlateItem key={task.id} task={task} first={i === 0} />
            ))}
          </div>
        )}
      </Section>
    </>
  )
}
