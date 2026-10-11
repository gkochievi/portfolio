import { useNavigate, Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { MessagesSquare, MoonStar, UserCheck, Users } from 'lucide-react'

import { Button, Card, CardHeader, EmptyState, ErrorState, KpiTile, PageHeader, Skeleton, SkeletonRow } from '@/components/ui'
import { errorMessage } from '@/api/client'
import { useNow } from '@/lib/realtime'

import { useDashboard } from '../api'
import { OperatorList } from '../components/OperatorList'
import { SessionRow } from '../components/SessionRow'

export default function DashboardPage() {
  const { t } = useTranslation(['adminLive', 'common'])
  const navigate = useNavigate()
  const query = useDashboard()
  const nowMs = useNow(1_000)
  const data = query.data
  const stats = data?.stats

  if (query.isError && !data) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title={t('dashboard.title')} description={t('dashboard.subtitle')} />
        <ErrorState title={t('dashboard.loadError')} description={errorMessage(query.error)} onRetry={() => void query.refetch()} retryLabel={t('common:actions.retry')} />
      </div>
    )
  }

  const away = stats?.operators.away ?? 0
  const offline = stats?.operators.offline ?? 0

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={t('dashboard.title')} description={t('dashboard.subtitle')} />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiTile
          label={t('dashboard.kpi.online')}
          value={stats?.operators.online ?? 0}
          hint={t('dashboard.kpi.onlineHint', { total: stats?.operators.total ?? 0 })}
          icon={<UserCheck size={18} strokeWidth={1.75} />}
          tone="success"
          loading={!stats}
        />
        <KpiTile
          label={t('dashboard.kpi.awayOffline')}
          value={away + offline}
          hint={t('dashboard.kpi.awayOfflineHint', { away, offline })}
          icon={<MoonStar size={18} strokeWidth={1.75} />}
          tone={away + offline > 0 ? 'warning' : 'default'}
          loading={!stats}
        />
        <KpiTile
          label={t('dashboard.kpi.activeCustomers')}
          value={stats?.customers.active ?? 0}
          hint={t('dashboard.kpi.activeCustomersHint', { waiting: stats?.customers.waiting ?? 0 })}
          icon={<Users size={18} strokeWidth={1.75} />}
          tone="accent"
          loading={!stats}
          onClick={() => navigate('/admin/chats')}
        />
        <KpiTile
          label={t('dashboard.kpi.totalToday')}
          value={stats?.sessions.today ?? 0}
          hint={t('dashboard.kpi.totalTodayHint', { total: stats?.sessions.total ?? 0 })}
          icon={<MessagesSquare size={18} strokeWidth={1.75} />}
          loading={!stats}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-12">
        <Card padding="none" className="overflow-hidden lg:col-span-5">
          <CardHeader
            title={t('dashboard.operators.title')}
            actions={
              <Button variant="ghost" size="sm" asChild>
                <Link to="/admin/operators">{t('dashboard.operators.manage')}</Link>
              </Button>
            }
            className="px-4 pt-4"
          />
          {!data ? (
            <div className="space-y-1 p-3">
              {[0, 1, 2, 3].map((i) => (
                <SkeletonRow key={i} />
              ))}
            </div>
          ) : (
            <OperatorList operators={data.operators} limit={data.limit} />
          )}
        </Card>

        <Card padding="none" className="overflow-hidden lg:col-span-7">
          <CardHeader
            title={t('dashboard.open.title')}
            actions={
              <Button variant="ghost" size="sm" asChild>
                <Link to="/admin/chats">{t('dashboard.open.viewAll')}</Link>
              </Button>
            }
            className="px-4 pt-4"
          />
          {!data ? (
            <div className="space-y-3 p-4">
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="h-14 w-full" />
              ))}
            </div>
          ) : data.openSessions.length === 0 ? (
            <EmptyState illustration="nest" compact title={t('dashboard.open.empty')} />
          ) : (
            <div>
              {data.openSessions.map((row) => (
                <SessionRow key={row.id} session={row} nowMs={nowMs} compact onSelect={(id) => navigate(`/admin/chats?session=${id}`)} />
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  )
}
