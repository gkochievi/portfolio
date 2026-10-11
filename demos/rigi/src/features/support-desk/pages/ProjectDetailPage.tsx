import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Ban, CheckCircle2, Pencil, Plus, Tag, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { ProjectStateChip, TaskStateChip } from '@/components/status'
import {
  Badge,
  Banner,
  Button,
  Card,
  CardBody,
  CardHeader,
  type Column,
  ConfirmDialog,
  DataTable,
  DateText,
  DescriptionList,
  EmptyState,
  IconButton,
  Mono,
  Money,
  NativeSelect,
  PageHeader,
  PageSkeleton,
  toast,
} from '@/components/ui'
import { formatPoints, formatProjectNumber, formatTaskNumber } from '@/lib/format'

import { errorMessage, type TaskLite, useProject, useProjectActions } from '../api'
import { CompleteProjectDialog, EditProjectDialog, SetPriceDialog } from '../components/ProjectDialogs'

type Dlg = 'edit' | 'price' | 'complete' | 'cancel' | null

export default function ProjectDetailPage() {
  const { t } = useTranslation(['support-desk', 'common'])
  const { projectId = '' } = useParams()
  const query = useProject(projectId)
  const actions = useProjectActions(projectId)
  const [dialog, setDialog] = useState<Dlg>(null)
  const [pick, setPick] = useState('')
  const [removing, setRemoving] = useState<TaskLite | null>(null)

  if (query.isPending) return <PageSkeleton />
  if (query.isError || !query.data) {
    return (
      <>
        <PageHeader title={t('project.notFoundTitle')} back={{ to: '/l1/projects', label: t('project.back') }} />
        <EmptyState title={t('project.notFound')} action={<Button variant="secondary" onClick={() => void query.refetch()}>{t('common:actions.retry')}</Button>} />
      </>
    )
  }

  const { project, tasks, candidates, billedInvoice } = query.data
  const isOpen = project.state === 'open'
  const priceValue = project.price === null ? <Badge tone="warning">{t('projects.pricingPending')}</Badge> : <Money amount={project.price} currency={project.currency} />

  const onAdd = () => {
    if (!pick) return
    actions.addTask.mutate(pick, {
      onSuccess: () => {
        setPick('')
        toast.success(t('project.taskAdded'))
      },
      onError: (e) => toast.error(errorMessage(e)),
    })
  }
  const onRemove = () => {
    if (!removing) return
    actions.removeTask.mutate(removing.id, {
      onSuccess: () => {
        setRemoving(null)
        toast.success(t('project.taskRemoved'))
      },
      onError: (e) => {
        setRemoving(null)
        toast.error(errorMessage(e))
      },
    })
  }
  const onCancel = () =>
    actions.cancel.mutate(undefined, {
      onSuccess: () => {
        setDialog(null)
        toast.success(t('project.cancelled'))
      },
      onError: (e) => {
        setDialog(null)
        toast.error(errorMessage(e))
      },
    })

  const columns: Column<TaskLite>[] = [
    {
      key: 'number',
      header: t('project.cols.task'),
      width: 110,
      cell: (r) => (
        <Link to={`/l1/tasks/${r.id}`} className="link">
          <Mono chip={false}>{formatTaskNumber(r.number)}</Mono>
        </Link>
      ),
    },
    { key: 'title', header: t('project.cols.title'), cell: (r) => <span className="line-clamp-2 text-ink">{r.title}</span> },
    { key: 'state', header: t('common:fields.status'), width: 130, cell: (r) => <TaskStateChip state={r.state} /> },
    {
      key: 'points',
      header: t('project.cols.points'),
      align: 'right',
      hideBelow: 'sm',
      width: 90,
      cell: (r) => <span className="num">{r.points === null ? '-' : formatPoints(r.points)}</span>,
    },
    ...(isOpen
      ? [
          {
            key: 'remove',
            header: <span className="sr-only">{t('project.remove')}</span>,
            align: 'right' as const,
            width: 56,
            cell: (r: TaskLite) => <IconButton label={t('project.remove')} icon={<X />} variant="destructive-ghost" size="sm" onClick={() => setRemoving(r)} />,
          },
        ]
      : []),
  ]

  return (
    <>
      <PageHeader
        eyebrow={formatProjectNumber(project.number)}
        title={project.name}
        back={{ to: '/l1/projects', label: t('project.back') }}
        meta={<ProjectStateChip state={project.state} />}
        actions={
          isOpen ? (
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="secondary" icon={<Pencil />} onClick={() => setDialog('edit')}>{t('common:actions.edit')}</Button>
              <Button variant="secondary" icon={<Tag />} onClick={() => setDialog('price')}>{t('project.setPrice')}</Button>
              <Button icon={<CheckCircle2 />} onClick={() => setDialog('complete')}>{t('project.complete')}</Button>
              <Button variant="destructive-ghost" icon={<Ban />} onClick={() => setDialog('cancel')}>{t('project.cancel')}</Button>
            </div>
          ) : null
        }
      />

      {project.pricingPending && isOpen ? (
        <div className="mb-4">
          <Banner tone="warning" title={t('project.pendingTitle')} action={<Button size="sm" variant="secondary" onClick={() => setDialog('price')}>{t('project.setPrice')}</Button>}>
            {t('project.pendingBody')}
          </Banner>
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0 space-y-6">
          <Card>
            <CardHeader title={t('project.tasksTitle')} description={t('project.tasksHint')} />
            <CardBody className="space-y-4">
              {isOpen ? (
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <div className="min-w-0 flex-1">
                    <NativeSelect
                      aria-label={t('project.addTask')}
                      value={pick}
                      onChange={(e) => setPick(e.target.value)}
                      placeholder={candidates.length ? t('project.pickTask') : t('project.noCandidates')}
                      disabled={candidates.length === 0}
                      options={candidates.map((c) => ({ value: c.id, label: `${formatTaskNumber(c.number)} · ${c.title}` }))}
                    />
                  </div>
                  <Button icon={<Plus />} disabled={!pick} loading={actions.addTask.isPending} onClick={onAdd}>
                    {t('project.addTask')}
                  </Button>
                </div>
              ) : null}
              <DataTable<TaskLite>
                columns={columns}
                rows={tasks}
                getRowId={(r) => r.id}
                pageSize={0}
                empty={{ title: t('project.noTasks'), description: isOpen ? t('project.noTasksHint') : undefined }}
                caption={t('project.tasksTitle')}
              />
            </CardBody>
          </Card>

          <Card>
            <CardHeader title={t('project.descriptionTitle')} />
            <CardBody>
              {project.description ? (
                <p className="whitespace-pre-wrap break-words text-sm leading-6 text-ink">{project.description}</p>
              ) : (
                <p className="text-sm text-muted">{t('project.noDescription')}</p>
              )}
              {project.priceAdjustNote ? (
                <div className="mt-4 border-t border-hairline pt-4">
                  <div className="eyebrow mb-1">{t('project.adjustNote')}</div>
                  <p className="whitespace-pre-wrap break-words text-sm leading-6 text-ink">{project.priceAdjustNote}</p>
                </div>
              ) : null}
            </CardBody>
          </Card>
        </div>

        <Card className="h-fit">
          <CardHeader title={t('project.details')} />
          <CardBody>
            <DescriptionList
              columns={1}
              items={[
                { label: t('projects.cols.partner'), value: project.partnerName },
                { label: t('common:fields.status'), value: <ProjectStateChip state={project.state} /> },
                { label: project.state === 'completed' ? t('project.finalPrice') : t('projects.cols.price'), value: priceValue },
                { label: t('project.requestedBy'), value: project.requestedByPartner ? t('project.byPartner') : t('project.byStaff') },
                { label: t('common:fields.createdAt'), value: <DateText value={project.createdAt} withTime /> },
                project.completedAt ? { label: t('project.completedAt'), value: <DateText value={project.completedAt} withTime /> } : null,
                project.cancelledAt ? { label: t('project.cancelledAt'), value: <DateText value={project.cancelledAt} withTime /> } : null,
                billedInvoice ? { label: t('project.billedOn'), value: billedInvoice.invoiceNumber ?? billedInvoice.id, mono: true } : null,
              ]}
            />
          </CardBody>
        </Card>
      </div>

      <EditProjectDialog open={dialog === 'edit'} onOpenChange={(o) => !o && setDialog(null)} project={project} />
      <SetPriceDialog open={dialog === 'price'} onOpenChange={(o) => !o && setDialog(null)} project={project} />
      <CompleteProjectDialog open={dialog === 'complete'} onOpenChange={(o) => !o && setDialog(null)} project={project} />
      <ConfirmDialog
        open={dialog === 'cancel'}
        onOpenChange={(o) => !o && setDialog(null)}
        title={t('project.cancelTitle')}
        description={t('project.cancelDescription')}
        confirmLabel={t('project.cancel')}
        cancelLabel={t('project.keep')}
        tone="danger"
        pending={actions.cancel.isPending}
        onConfirm={onCancel}
      />
      <ConfirmDialog
        open={removing !== null}
        onOpenChange={(o) => !o && setRemoving(null)}
        title={t('project.removeTitle')}
        description={removing ? t('project.removeDescription', { number: formatTaskNumber(removing.number) }) : undefined}
        confirmLabel={t('project.remove')}
        tone="danger"
        pending={actions.removeTask.isPending}
        onConfirm={onRemove}
      />
    </>
  )
}
