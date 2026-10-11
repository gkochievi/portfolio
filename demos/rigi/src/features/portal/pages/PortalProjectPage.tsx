/** /partner/projects/:projectId: status, price and member tasks. Owner: portal. */
import { Link, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

import { isApiError } from '@/api/client'
import { ProjectStateChip, TaskStateChip } from '@/components/status'
import { Button, Card, CardBody, CardHeader, DataTable, DateText, DescriptionList, EmptyState, Mono, Money, PageHeader, PageSkeleton, type Column } from '@/components/ui'
import { formatProjectNumber, formatTaskNumber } from '@/lib/format'

import { usePortalProject, type PortalTaskRow } from '../api'

export default function PortalProjectPage() {
  const { t } = useTranslation('portal')
  const { projectId = '' } = useParams()
  const query = usePortalProject(projectId)
  const project = query.data

  if (query.isLoading) return <PageSkeleton />
  if (query.error || !project) {
    const missing = isApiError(query.error, 404)
    return (
      <>
        <PageHeader back={{ to: '/partner/projects', label: t('project.back') }} title={t('projects.title')} />
        <EmptyState
          title={missing ? t('project.notFound') : t('project.loadError')}
          action={
            missing ? (
              <Button asChild variant="outline">
                <Link to="/partner/projects">{t('project.back')}</Link>
              </Button>
            ) : (
              <Button variant="outline" onClick={() => void query.refetch()}>
                {t('common:actions.retry')}
              </Button>
            )
          }
        />
      </>
    )
  }

  const columns: Column<PortalTaskRow>[] = [
    { key: 'number', header: '№', width: '96px', sortable: true, cell: (r) => <Mono>{formatTaskNumber(r.number)}</Mono> },
    { key: 'title', header: t('list.columns.title'), sortable: true, cell: (r) => <span className="font-medium">{r.title}</span> },
    { key: 'state', header: t('list.columns.state'), cell: (r) => <TaskStateChip state={r.state} realm="partner" /> },
    {
      key: 'deadline',
      header: t('list.columns.deadline'),
      hideBelow: 'sm',
      sortValue: (r) => r.deadline ?? '9999',
      sortable: true,
      cell: (r) => (r.deadline ? <DateText value={r.deadline} /> : <span className="text-subtle">—</span>),
    },
  ]

  const priced = !project.pricingPending && project.price !== null

  return (
    <>
      <PageHeader
        back={{ to: '/partner/projects', label: t('project.back') }}
        eyebrow={<Mono>{formatProjectNumber(project.number)}</Mono>}
        title={project.name}
        meta={
          <div className="flex flex-wrap items-center gap-3 text-[13px]">
            <ProjectStateChip state={project.state} />
            {priced ? <Money amount={project.price} currency={project.currency} /> : <span className="text-muted">{t('project.pricingPending')}</span>}
          </div>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0 space-y-6">
          <Card>
            <CardHeader title={t('project.description')} />
            <CardBody>
              <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">{project.description || <span className="text-muted">{t('project.noDescription')}</span>}</p>
            </CardBody>
          </Card>
          <Card>
            <CardHeader title={t('project.tasks')} description={t('project.tasksNote')} />
            <DataTable
              caption={t('project.tasks')}
              columns={columns}
              rows={project.tasks}
              getRowId={(r) => r.id}
              rowHref={(r) => `/partner/tasks/${r.id}`}
              pageSize={0}
              initialSort={{ key: 'number', dir: 'asc' }}
              empty={{ title: t('project.tasksEmpty') }}
            />
          </Card>
        </div>
        <aside className="min-w-0">
          <Card>
            <CardBody>
              <DescriptionList
                columns={1}
                items={[
                  { label: t('project.state'), value: <ProjectStateChip state={project.state} /> },
                  {
                    label: t('project.price'),
                    value: priced ? <Money amount={project.price} currency={project.currency} /> : t('project.pricingPending'),
                  },
                  { label: t('project.created'), value: <DateText value={project.createdAt} /> },
                ]}
              />
              {!priced ? <p className="mt-3 text-[13px] text-muted">{t('project.pricingPendingHint')}</p> : null}
            </CardBody>
          </Card>
        </aside>
      </div>
    </>
  )
}
