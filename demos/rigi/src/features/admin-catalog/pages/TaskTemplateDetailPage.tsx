import { useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate, useParams } from 'react-router-dom'

import {
  Badge,
  Banner,
  Button,
  Card,
  CardBody,
  CardHeader,
  ConfirmDialog,
  DataTable,
  DateText,
  Dialog,
  EmptyState,
  Field,
  IconButton,
  Input,
  PageHeader,
  PageSkeleton,
  Select,
  SelectItem,
  toast,
  type Column,
} from '@/components/ui'
import { formatDate, formatPoints } from '@/lib/format'

import {
  apiErrorMessage,
  applyFieldErrors,
  useAddPartnerRate,
  useDeleteTemplate,
  useRemovePartnerRate,
  useTaskTemplate,
  useUpdateTemplate,
  type TemplateDetail,
} from '../api'
import { TemplateForm } from '../components/TemplateForm'

type PriceRow = TemplateDetail['partnerPrices'][number]

function PartnerPrices({ detail }: { detail: TemplateDetail }) {
  const { t } = useTranslation(['admin-catalog', 'common'])
  const { template, partnerPrices, availablePartners } = detail
  const add = useAddPartnerRate(template.id)
  const remove = useRemovePartnerRate(template.id)
  const [adding, setAdding] = useState(false)
  const [partnerId, setPartnerId] = useState('')
  const [points, setPoints] = useState('')
  const [errors, setErrors] = useState<{ partnerId?: string; points?: string }>({})
  const [removing, setRemoving] = useState<PriceRow | null>(null)

  const readOnly = Boolean(template.archivedAt)
  const locked = template.isFreeform

  const openAdd = () => {
    setPartnerId('')
    setPoints('')
    setErrors({})
    setAdding(true)
  }

  const submitAdd = async () => {
    const next: typeof errors = {}
    if (!partnerId) next.partnerId = t('validation.required')
    const n = Number(points)
    if (points.trim() === '') next.points = t('validation.required')
    else if (!Number.isFinite(n) || n < 0) next.points = t('validation.pointsMin')
    else if (Math.abs(n * 100 - Math.round(n * 100)) > 1e-6) next.points = t('validation.pointsStep')
    setErrors(next)
    if (Object.keys(next).length) return
    try {
      await add.mutateAsync({ partnerId, points: n })
      toast.success(t('prices.added'))
      setAdding(false)
    } catch (e) {
      const mapped: typeof errors = {}
      const claimed = applyFieldErrors(t, e, ((name: string, err: { message: string }) => {
        if (name === 'partnerId' || name === 'points') mapped[name] = err.message
      }) as never)
      if (claimed) setErrors(mapped)
      else toast.error(apiErrorMessage(t, e))
    }
  }

  const confirmRemove = async () => {
    if (!removing) return
    try {
      await remove.mutateAsync(removing.partnerId)
      toast.success(t('prices.removed'))
      setRemoving(null)
    } catch (e) {
      toast.error(apiErrorMessage(t, e))
    }
  }

  const columns: Column<PriceRow>[] = [
    {
      key: 'partner',
      header: t('prices.partner'),
      sortable: true,
      sortValue: (r) => r.partnerName.toLowerCase(),
      cell: (r) => (
        <Link to={`/admin/partners/${r.partnerId}`} className="link font-medium">
          {r.partnerName}
        </Link>
      ),
    },
    {
      key: 'points',
      header: t('prices.points'),
      align: 'right',
      sortable: true,
      sortValue: (r) => r.points,
      cell: (r) => (
        <span className="num">
          {formatPoints(r.points)}
          {template.defaultPoints !== null && r.points !== template.defaultPoints ? (
            <span className="ml-2 text-xs text-subtle">{t('prices.default', { points: formatPoints(template.defaultPoints) })}</span>
          ) : null}
        </span>
      ),
    },
  ]
  if (!readOnly) {
    columns.push({
      key: 'actions',
      header: '',
      align: 'right',
      width: '56px',
      cell: (r) => (
        <IconButton
          label={t('prices.remove')}
          variant="destructive-ghost"
          size="sm"
          icon={<Trash2 />}
          onClick={() => setRemoving(r)}
        />
      ),
    })
  }

  return (
    <Card>
      <CardHeader
        title={t('prices.title')}
        description={t('prices.description')}
        actions={
          !readOnly && !locked ? (
            <Button size="sm" icon={<Plus />} onClick={openAdd} disabled={availablePartners.length === 0}>
              {t('prices.add')}
            </Button>
          ) : null
        }
      />
      <CardBody className="p-0">
        {locked ? (
          <div className="p-4">
            <Banner tone="info">{t('prices.freeform')}</Banner>
          </div>
        ) : (
          <DataTable
            columns={columns}
            rows={partnerPrices}
            getRowId={(r) => r.partnerId}
            initialSort={{ key: 'partner', dir: 'asc' }}
            pageSize={0}
            empty={{ title: t('prices.empty'), description: t('prices.emptyDescription') }}
          />
        )}
      </CardBody>

      <Dialog
        open={adding}
        onOpenChange={setAdding}
        title={t('prices.addTitle')}
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setAdding(false)} disabled={add.isPending}>
              {t('common:actions.cancel')}
            </Button>
            <Button onClick={() => void submitAdd()} loading={add.isPending}>
              {t('prices.add')}
            </Button>
          </>
        }
      >
        <form
          className="grid gap-4"
          onSubmit={(e) => {
            e.preventDefault()
            void submitAdd()
          }}
          noValidate
        >
          <Field label={t('prices.partner')} required error={errors.partnerId} hint={availablePartners.length === 0 ? t('prices.noPartnersLeft') : undefined}>
            <Select
              value={partnerId}
              onValueChange={setPartnerId}
              placeholder={t('prices.choosePartner')}
              invalid={Boolean(errors.partnerId)}
              aria-label={t('prices.partner')}
            >
              {availablePartners.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name}
                </SelectItem>
              ))}
            </Select>
          </Field>
          <Field
            label={t('prices.points')}
            required
            error={errors.points}
            htmlFor="rate-points"
            hint={template.defaultPoints !== null ? t('prices.default', { points: formatPoints(template.defaultPoints) }) : undefined}
          >
            <Input
              id="rate-points"
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0"
              mono
              value={points}
              onChange={(e) => setPoints(e.target.value)}
              invalid={Boolean(errors.points)}
            />
          </Field>
          <button type="submit" hidden />
        </form>
      </Dialog>

      <ConfirmDialog
        open={Boolean(removing)}
        onOpenChange={(o) => !o && setRemoving(null)}
        title={t('prices.removeTitle', { partner: removing?.partnerName ?? '' })}
        description={t('prices.removeBody')}
        confirmLabel={t('prices.remove')}
        tone="danger"
        onConfirm={() => void confirmRemove()}
        pending={remove.isPending}
      />
    </Card>
  )
}

export default function TaskTemplateDetailPage() {
  const { t } = useTranslation(['admin-catalog', 'common'])
  const { templateId } = useParams()
  const navigate = useNavigate()
  const { data, error, isLoading } = useTaskTemplate(templateId)
  const update = useUpdateTemplate(templateId ?? '')
  const del = useDeleteTemplate(templateId ?? '')
  const [confirmDelete, setConfirmDelete] = useState(false)

  if (isLoading) return <PageSkeleton />
  if (error || !data) {
    return (
      <div>
        <PageHeader eyebrow={t('templates.eyebrow')} title={t('templateForm.notFound')} back={{ to: '/admin/task-templates', label: t('templates.title') }} />
        <EmptyState title={t('templateForm.notFound')} action={<Button variant="secondary" asChild><Link to="/admin/task-templates">{t('templates.title')}</Link></Button>} />
      </div>
    )
  }

  const { template, taskCount } = data
  const archived = Boolean(template.archivedAt)

  const onDelete = async () => {
    try {
      const res = await del.mutateAsync()
      toast.success(res.archived ? t('templateForm.archivedToast') : t('templateForm.deleted'))
      setConfirmDelete(false)
      navigate('/admin/task-templates', { replace: true })
    } catch (e) {
      toast.error(apiErrorMessage(t, e))
    }
  }

  return (
    <div>
      <PageHeader
        eyebrow={t('templates.eyebrow')}
        title={template.name}
        back={{ to: '/admin/task-templates', label: t('templates.title') }}
        meta={
          <>
            {archived ? (
              <Badge tone="neutral">{t('templates.status.archived')}</Badge>
            ) : template.isActive ? (
              <Badge tone="success">{t('templates.status.active')}</Badge>
            ) : (
              <Badge tone="warning">{t('templates.status.disabled')}</Badge>
            )}
            <Badge tone={template.isFreeform ? 'accent' : 'outline'} dot={false}>
              {t(template.isFreeform ? 'templates.type.freeform' : 'templates.type.fixed')}
            </Badge>
            <span className="text-xs text-muted">
              {t('templateForm.createdAt')} <DateText value={template.createdAt} />
            </span>
            <span className="num text-xs text-muted">{taskCount > 0 ? t('templateForm.tasks', { count: taskCount }) : t('templateForm.noTasks')}</span>
          </>
        }
        actions={
          archived ? null : (
            <Button variant="destructive" icon={<Trash2 />} onClick={() => setConfirmDelete(true)}>
              {t('templateForm.delete')}
            </Button>
          )
        }
      />

      {archived ? (
        <div className="mb-4">
          <Banner tone="warning">{t('templateForm.archivedBanner', { date: formatDate(template.archivedAt) })}</Banner>
        </div>
      ) : null}

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        {/* key: re-seed the form when the template changes underneath it (another tab, reset) */}
        <TemplateForm
          key={`${template.id}:${template.name}:${template.description}:${template.defaultPoints}:${template.isFreeform}:${template.isActive}`}
          template={template}
          readOnly={archived}
          title={template.name}
          submitLabel={t('common:actions.save')}
          onSubmit={async (values) => {
            await update.mutateAsync(values)
            toast.success(t('templateForm.saved'))
          }}
        />
        <PartnerPrices detail={data} />
      </div>

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title={t('templateForm.deleteTitle')}
        description={taskCount > 0 ? t('templateForm.deleteBodyArchive') : t('templateForm.deleteBody')}
        confirmLabel={t('templateForm.delete')}
        tone="danger"
        onConfirm={() => void onDelete()}
        pending={del.isPending}
      />
    </div>
  )
}
