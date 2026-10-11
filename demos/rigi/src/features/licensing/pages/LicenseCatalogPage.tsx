/** License catalog. Route: /admin/licenses. Owner: licensing. */
import { zodResolver } from '@hookform/resolvers/zod'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { z } from 'zod'

import {
  Badge,
  Banner,
  Button,
  DataTable,
  Dialog,
  Field,
  IconButton,
  Input,
  Mono,
  Money,
  NativeSelect,
  PageHeader,
  Switch,
  type Column,
} from '@/components/ui'
import { ActiveChip } from '@/components/status'
import { isApiError } from '@/lib/api'
import { useStaffMe } from '@/lib/session'
import type { Currency, LicenseKind } from '@/types'

import { useCreateLicense, useDeleteLicense, useLicenses, useUpdateLicense, type LicenseRow } from '../api'
import { errorText } from '../lib/errors'

const CURRENCIES: Currency[] = ['GEL', 'USD', 'EUR']
const KINDS: LicenseKind[] = ['per_user', 'addon']

/** Mirrors the handler: the code is the UPPER_SNAKE form of the name. */
function previewCode(name: string): string {
  return name
    .normalize('NFKD')
    .replace(/[^A-Za-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .toUpperCase()
}

interface FormValues {
  name: string
  kind: LicenseKind
  unitPrice: number
  currency: Currency
  isActive: boolean
}

export default function LicenseCatalogPage() {
  const { t } = useTranslation('licensing')
  const me = useStaffMe()
  const isSuper = me?.role === 'superadmin'
  const licenses = useLicenses()
  const [editing, setEditing] = useState<LicenseRow | 'new' | null>(null)
  const [deleting, setDeleting] = useState<LicenseRow | null>(null)

  const columns: Column<LicenseRow>[] = [
    { key: 'code', header: t('catalog.cols.code'), sortable: true, sortValue: (r) => r.code, cell: (r) => <Mono>{r.code}</Mono> },
    {
      key: 'name',
      header: t('catalog.cols.name'),
      sortable: true,
      sortValue: (r) => r.name,
      cell: (r) => <span className="font-medium text-ink">{r.name}</span>,
    },
    {
      key: 'kind',
      header: t('catalog.cols.kind'),
      hideBelow: 'sm',
      sortable: true,
      sortValue: (r) => r.kind,
      cell: (r) => <Badge tone={r.kind === 'addon' ? 'accent' : 'neutral'}>{t(`common:licenseKind.${r.kind}`)}</Badge>,
    },
    {
      key: 'unitPrice',
      header: t('catalog.cols.price'),
      align: 'right',
      sortable: true,
      sortValue: (r) => r.unitPrice,
      cell: (r) => <Money amount={r.unitPrice} currency={r.currency} />,
    },
    { key: 'currency', header: t('catalog.cols.currency'), hideBelow: 'md', cell: (r) => <span className="font-mono text-xs">{r.currency}</span> },
    {
      key: 'seats',
      header: t('catalog.cols.seats'),
      align: 'right',
      hideBelow: 'md',
      sortable: true,
      sortValue: (r) => r.seatsAllocated,
      cell: (r) => <span className="num">{r.seatsAllocated}</span>,
    },
    { key: 'isActive', header: t('catalog.cols.active'), cell: (r) => <ActiveChip active={r.isActive} /> },
    ...(isSuper
      ? [
          {
            key: 'actions',
            header: <span className="sr-only">{t('catalog.cols.actions')}</span>,
            align: 'right' as const,
            width: '96px',
            cell: (r: LicenseRow) => (
              <div className="flex justify-end gap-1">
                <IconButton label={t('common:actions.edit')} icon={<Pencil />} size="sm" onClick={() => setEditing(r)} />
                <IconButton label={t('common:actions.delete')} icon={<Trash2 />} size="sm" variant="destructive-ghost" onClick={() => setDeleting(r)} />
              </div>
            ),
          },
        ]
      : []),
  ]

  return (
    <>
      <PageHeader
        eyebrow={t('catalog.eyebrow')}
        title={t('catalog.title')}
        description={t('catalog.description')}
        actions={
          isSuper ? (
            <Button icon={<Plus />} onClick={() => setEditing('new')}>
              {t('catalog.new')}
            </Button>
          ) : undefined
        }
      />
      <DataTable
        columns={columns}
        rows={licenses.data}
        getRowId={(r) => r.id}
        rowNumbers
        error={licenses.error ? errorText(t, licenses.error) : undefined}
        onRetry={() => void licenses.refetch()}
        pageSize={0}
        empty={{
          title: t('catalog.empty'),
          description: t('catalog.emptyHint'),
          action: isSuper ? <Button icon={<Plus />} onClick={() => setEditing('new')}>{t('catalog.new')}</Button> : undefined,
        }}
      />
      {editing ? <LicenseDialog license={editing === 'new' ? null : editing} onClose={() => setEditing(null)} /> : null}
      {deleting ? <DeleteDialog license={deleting} onClose={() => setDeleting(null)} /> : null}
    </>
  )
}

/* ------------------------------------------------------------ create / edit */

function LicenseDialog({ license, onClose }: { license: LicenseRow | null; onClose: () => void }) {
  const { t } = useTranslation('licensing')
  const create = useCreateLicense()
  const update = useUpdateLicense()
  const isEdit = license !== null

  const schema = useMemo(
    () =>
      z.object({
        name: z.string().trim().min(1, t('catalog.errors.nameRequired')).max(120, t('catalog.errors.nameLong')),
        kind: z.enum(['per_user', 'addon'], { errorMap: () => ({ message: t('catalog.errors.kindRequired') }) }),
        unitPrice: z
          .number({ invalid_type_error: t('catalog.errors.priceRequired'), required_error: t('catalog.errors.priceRequired') })
          .min(0, t('catalog.errors.priceNegative'))
          .max(1_000_000, t('catalog.errors.priceHuge')),
        currency: z.enum(['GEL', 'USD', 'EUR'], { errorMap: () => ({ message: t('catalog.errors.currencyRequired') }) }),
        isActive: z.boolean(),
      }),
    [t],
  )

  const {
    register,
    control,
    handleSubmit,
    watch,
    setError,
    setFocus,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: license?.name ?? '',
      kind: license?.kind ?? 'per_user',
      unitPrice: license?.unitPrice ?? 0,
      currency: license?.currency ?? 'GEL',
      isActive: license?.isActive ?? true,
    },
  })

  useEffect(() => {
    const id = window.setTimeout(() => setFocus('name'), 60)
    return () => window.clearTimeout(id)
  }, [setFocus])

  const name = watch('name')
  const pending = create.isPending || update.isPending

  async function onSubmit(values: FormValues) {
    try {
      if (isEdit) {
        await update.mutateAsync({ id: license.id, ...values })
        toast.success(t('catalog.updated', { name: values.name }))
      } else {
        const created = await create.mutateAsync(values)
        toast.success(t('catalog.created', { name: created.name, code: created.code }))
      }
      onClose()
    } catch (e) {
      const fields = (e as { fieldErrors?: Record<string, string[]> }).fieldErrors
      let shown = false
      for (const key of ['name', 'kind', 'unitPrice', 'currency'] as const) {
        const msg = fields?.[key]?.[0]
        if (msg) {
          setError(key, { message: msg })
          shown = true
        }
      }
      if (!shown) toast.error(errorText(t, e))
    }
  }

  return (
    <Dialog
      open
      onOpenChange={(o) => !o && onClose()}
      title={isEdit ? t('catalog.editTitle') : t('catalog.newTitle')}
      description={isEdit ? t('catalog.editDescription') : t('catalog.newDescription')}
      size="md"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {t('common:actions.cancel')}
          </Button>
          <Button type="submit" form="license-form" loading={pending}>
            {isEdit ? t('common:actions.save') : t('common:actions.create')}
          </Button>
        </>
      }
    >
      <form id="license-form" onSubmit={(e) => void handleSubmit(onSubmit)(e)} className="space-y-4" noValidate>
        <Field label={t('catalog.form.name')} required error={errors.name?.message} htmlFor="lic-name">
          <Input id="lic-name" invalid={!!errors.name} maxLength={120} {...register('name')} />
        </Field>
        <Field
          label={t('catalog.form.code')}
          hint={isEdit ? t('catalog.form.codeLocked') : t('catalog.form.codeAuto')}
          htmlFor="lic-code"
        >
          <Input id="lic-code" mono readOnly disabled value={isEdit ? license.code : previewCode(name) || '—'} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t('catalog.form.kind')} required error={errors.kind?.message} htmlFor="lic-kind">
            <NativeSelect
              id="lic-kind"
              invalid={!!errors.kind}
              options={KINDS.map((k) => ({ value: k, label: t(`common:licenseKind.${k}`) }))}
              {...register('kind')}
            />
          </Field>
          <Field label={t('catalog.form.currency')} required error={errors.currency?.message} htmlFor="lic-cur">
            <NativeSelect
              id="lic-cur"
              invalid={!!errors.currency}
              options={CURRENCIES.map((c) => ({ value: c, label: c }))}
              {...register('currency')}
            />
          </Field>
        </div>
        <Field label={t('catalog.form.unitPrice')} hint={t('catalog.form.priceHint')} required error={errors.unitPrice?.message} htmlFor="lic-price">
          <Input id="lic-price" type="number" step="0.01" min={0} inputMode="decimal" className="num" invalid={!!errors.unitPrice} {...register('unitPrice', { valueAsNumber: true })} />
        </Field>
        <Controller
          control={control}
          name="isActive"
          render={({ field }) => (
            <Switch
              checked={field.value}
              onCheckedChange={field.onChange}
              label={t('catalog.form.active')}
              description={t('catalog.form.activeHint')}
            />
          )}
        />
      </form>
    </Dialog>
  )
}

/* ------------------------------------------------------------------ delete */

function DeleteDialog({ license, onClose }: { license: LicenseRow; onClose: () => void }) {
  const { t } = useTranslation('licensing')
  const del = useDeleteLicense()
  const update = useUpdateLicense()
  const [conflict, setConflict] = useState(false)

  async function remove() {
    try {
      await del.mutateAsync(license.id)
      toast.success(t('catalog.deleted', { name: license.name }))
      onClose()
    } catch (e) {
      if (isApiError(e, 409)) setConflict(true)
      else toast.error(errorText(t, e))
    }
  }

  async function deactivate() {
    try {
      await update.mutateAsync({ id: license.id, isActive: false })
      toast.success(t('catalog.deactivated', { name: license.name }))
      onClose()
    } catch (e) {
      toast.error(errorText(t, e))
    }
  }

  return (
    <Dialog
      open
      onOpenChange={(o) => !o && onClose()}
      title={t('catalog.deleteTitle', { name: license.name })}
      description={t('catalog.deleteDescription')}
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {t('common:actions.cancel')}
          </Button>
          {conflict && license.isActive ? (
            <Button variant="primary" loading={update.isPending} onClick={() => void deactivate()}>
              {t('catalog.deactivateInstead')}
            </Button>
          ) : null}
          {!conflict ? (
            <Button variant="destructive" loading={del.isPending} onClick={() => void remove()}>
              {t('common:actions.delete')}
            </Button>
          ) : null}
        </>
      }
    >
      <div className="space-y-3">
        <p className="text-sm text-muted">
          <Mono>{license.code}</Mono>
        </p>
        {conflict ? (
          <Banner tone="warning" title={t('catalog.inUseTitle')}>
            {license.isActive ? t('catalog.inUseHint') : t('catalog.inUseInactive')}
          </Banner>
        ) : null}
      </div>
    </Dialog>
  )
}
