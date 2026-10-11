import { useState } from 'react'
import { Eye, EyeOff, Pencil, RotateCcw } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import {
  Badge,
  Button,
  Card,
  CardHeader,
  ConfirmDialog,
  DataTable,
  Dialog,
  Field,
  IconButton,
  Input,
  Mono,
  Textarea,
  toast,
  type Column,
} from '@/components/ui'
import { formatPoints } from '@/lib/format'

import {
  apiErrorMessage,
  usePartnerCatalogue,
  useResetCatalogueOverride,
  useSaveCatalogueOverride,
  type PartnerCatalogueRow,
} from '../api'

interface DraftErrors {
  name?: string
  description?: string
  points?: string
}

export function PartnerTemplatesPanel({ partnerId }: { partnerId: string }) {
  const { t } = useTranslation(['admin-catalog', 'common'])
  const { data, error, refetch, isLoading } = usePartnerCatalogue(partnerId)
  const save = useSaveCatalogueOverride(partnerId)
  const reset = useResetCatalogueOverride(partnerId)

  const [editing, setEditing] = useState<PartnerCatalogueRow | null>(null)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [points, setPoints] = useState('')
  const [errors, setErrors] = useState<DraftErrors>({})
  const [resetting, setResetting] = useState<PartnerCatalogueRow | null>(null)

  const openEdit = (row: PartnerCatalogueRow) => {
    setEditing(row)
    setName(row.nameOverride ?? '')
    setDescription(row.descriptionOverride ?? '')
    setPoints(row.pointsOverride !== null ? String(row.pointsOverride) : '')
    setErrors({})
  }

  const toggleHidden = async (row: PartnerCatalogueRow) => {
    try {
      await save.mutateAsync({ templateId: row.templateId, isHidden: !row.isHidden })
      toast.success(row.isHidden ? t('catalogue.shownDone') : t('catalogue.hiddenDone'))
    } catch (e) {
      toast.error(apiErrorMessage(t, e))
    }
  }

  const submitEdit = async () => {
    if (!editing) return
    const next: DraftErrors = {}
    const trimmedPoints = points.trim()
    let pointsValue: number | null = null
    if (name.length > 200) next.name = t('validation.tooLong')
    if (description.length > 4000) next.description = t('validation.tooLong')
    if (trimmedPoints !== '') {
      const n = Number(trimmedPoints)
      if (!Number.isFinite(n) || n < 0) next.points = t('validation.pointsMin')
      else if (Math.abs(n * 100 - Math.round(n * 100)) > 1e-6) next.points = t('validation.pointsStep')
      else pointsValue = n
    }
    setErrors(next)
    if (Object.keys(next).length) return
    try {
      await save.mutateAsync({
        templateId: editing.templateId,
        nameOverride: name.trim() || null,
        descriptionOverride: description.trim() || null,
        points: editing.isFreeform ? null : pointsValue,
      })
      toast.success(t('catalogue.saved'))
      setEditing(null)
    } catch (e) {
      toast.error(apiErrorMessage(t, e))
    }
  }

  const confirmReset = async () => {
    if (!resetting) return
    try {
      await reset.mutateAsync(resetting.templateId)
      toast.success(t('catalogue.resetDone'))
    } catch (e) {
      toast.error(apiErrorMessage(t, e))
    }
    setResetting(null)
  }

  const columns: Column<PartnerCatalogueRow>[] = [
    {
      key: 'template',
      header: t('catalogue.col.template'),
      sortable: true,
      sortValue: (r) => r.effectiveName.toLowerCase(),
      cell: (r) => (
        <div className={r.isHidden ? 'min-w-0 opacity-60' : 'min-w-0'}>
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium text-ink">{r.effectiveName}</span>
            {r.nameOverride ? (
              <Badge tone="accent" dot={false}>
                {t('catalogue.renamed')}
              </Badge>
            ) : null}
            {!r.isActive ? (
              <Badge tone="neutral" dot={false}>
                {t('catalogue.inactive')}
              </Badge>
            ) : null}
          </div>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-muted">
            <Mono>{r.code}</Mono>
            {r.effectiveDescription ? <span className="max-w-md truncate">{r.effectiveDescription}</span> : null}
          </div>
        </div>
      ),
    },
    {
      key: 'default',
      header: t('catalogue.col.default'),
      align: 'right',
      hideBelow: 'md',
      sortable: true,
      sortValue: (r) => r.defaultPoints ?? -1,
      cell: (r) => (r.defaultPoints === null ? <span className="text-subtle">—</span> : <span className="num text-muted">{formatPoints(r.defaultPoints)}</span>),
    },
    {
      key: 'effective',
      header: t('catalogue.col.effective'),
      align: 'right',
      sortable: true,
      sortValue: (r) => r.effectivePoints ?? -1,
      cell: (r) =>
        r.effectivePoints === null ? (
          <Badge tone="outline" dot={false}>
            {t('catalogue.freeform')}
          </Badge>
        ) : (
          <span className="num inline-flex items-center justify-end gap-2">
            {r.pointsOverride !== null ? (
              <Badge tone="accent" dot={false}>
                {t('catalogue.priced')}
              </Badge>
            ) : null}
            <span className="font-medium">{formatPoints(r.effectivePoints)}</span>
          </span>
        ),
    },
    {
      key: 'status',
      header: t('catalogue.col.status'),
      sortable: true,
      sortValue: (r) => (r.isHidden ? 1 : 0),
      cell: (r) => <Badge tone={r.isHidden ? 'warning' : 'success'}>{r.isHidden ? t('catalogue.hidden') : t('catalogue.visible')}</Badge>,
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      width: '132px',
      cell: (r) => (
        <div className="flex justify-end gap-0.5">
          <IconButton
            label={r.isHidden ? t('catalogue.show') : t('catalogue.hide')}
            size="sm"
            icon={r.isHidden ? <Eye /> : <EyeOff />}
            onClick={() => void toggleHidden(r)}
            disabled={save.isPending}
          />
          <IconButton label={t('catalogue.edit')} size="sm" icon={<Pencil />} onClick={() => openEdit(r)} />
          <IconButton
            label={t('catalogue.reset')}
            size="sm"
            icon={<RotateCcw />}
            disabled={!r.hasOverride}
            onClick={() => setResetting(r)}
          />
        </div>
      ),
    },
  ]

  return (
    <Card>
      <CardHeader title={t('catalogue.title')} description={t('catalogue.description')} />
      <DataTable
        columns={columns}
        rows={isLoading ? undefined : data}
        getRowId={(r) => r.templateId}
        error={error ? (error as Error).message : undefined}
        onRetry={() => void refetch()}
        pageSize={0}
        empty={{ title: t('catalogue.empty'), description: t('catalogue.emptyDescription') }}
      />

      <Dialog
        open={Boolean(editing)}
        onOpenChange={(o) => !o && setEditing(null)}
        title={t('catalogue.editTitle', { name: editing?.name ?? '' })}
        size="md"
        footer={
          <>
            <Button variant="ghost" onClick={() => setEditing(null)} disabled={save.isPending}>
              {t('common:actions.cancel')}
            </Button>
            <Button onClick={() => void submitEdit()} loading={save.isPending}>
              {t('common:actions.save')}
            </Button>
          </>
        }
      >
        {editing ? (
          <form
            className="grid gap-4"
            noValidate
            onSubmit={(e) => {
              e.preventDefault()
              void submitEdit()
            }}
          >
            <Field label={t('catalogue.nameOverride')} hint={editing.name} error={errors.name} htmlFor="ov-name">
              <Input id="ov-name" value={name} onChange={(e) => setName(e.target.value)} placeholder={editing.name} invalid={Boolean(errors.name)} />
            </Field>
            <Field label={t('catalogue.descriptionOverride')} hint={t('catalogue.leaveBlank')} error={errors.description} htmlFor="ov-desc">
              <Textarea
                id="ov-desc"
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={editing.description}
                invalid={Boolean(errors.description)}
              />
            </Field>
            <Field
              label={t('catalogue.pointsOverride')}
              hint={editing.isFreeform ? t('catalogue.freeformPoints') : t('catalogue.leaveBlank')}
              error={errors.points}
              htmlFor="ov-points"
            >
              <Input
                id="ov-points"
                type="number"
                inputMode="decimal"
                step="0.01"
                min="0"
                mono
                className="max-w-40"
                value={points}
                onChange={(e) => setPoints(e.target.value)}
                placeholder={editing.defaultPoints !== null ? String(editing.defaultPoints) : ''}
                disabled={editing.isFreeform}
                invalid={Boolean(errors.points)}
              />
            </Field>
            <button type="submit" hidden />
          </form>
        ) : null}
      </Dialog>

      <ConfirmDialog
        open={Boolean(resetting)}
        onOpenChange={(o) => !o && setResetting(null)}
        title={t('catalogue.resetTitle', { name: resetting?.effectiveName ?? '' })}
        description={t('catalogue.resetBody')}
        confirmLabel={t('catalogue.reset')}
        onConfirm={() => void confirmReset()}
        pending={reset.isPending}
      />
    </Card>
  )
}

export default PartnerTemplatesPanel
