import { zodResolver } from '@hookform/resolvers/zod'
import { Ban, Trash2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { z } from 'zod'

import { Button, ConfirmDialog, DataTable, Field, IconButton, Input, Modal, Pill, SegmentedControl, Select, toast, type Column } from '@/components/ui'
import { formatDate, pickText } from '@/lib/format'
import type { BannedClient } from '@/types'

import { useBanMutations, useBans, useCustomFields } from '../api'
import { useSettingsErrors } from '../shared'

const FORM_ID = 'ban-form'
const IPV4 = /^(25[0-5]|2[0-4]\d|1?\d?\d)(\.(25[0-5]|2[0-4]\d|1?\d?\d)){3}$/
const IPV6 = /^[0-9a-f:]{3,39}$/i

interface FormValues {
  type: 'ip' | 'customField'
  fieldId: string
  value: string
  reason: string
}

export function BansPanel({ onClose }: { onClose: () => void }) {
  const { t, i18n } = useTranslation('adminSettings')
  const tc = useTranslation().t
  const lang = i18n.language.startsWith('ka') ? 'ka' : 'en'
  const query = useBans()
  const fieldsQuery = useCustomFields()
  const { create, remove } = useBanMutations()
  const errors = useSettingsErrors()
  const [deleting, setDeleting] = useState<BannedClient | null>(null)

  const fields = fieldsQuery.data ?? []
  const fieldName = (id: string | null, fallback: string | null) => {
    const field = fields.find((row) => row.id === id)
    return field ? pickText(field.label, lang) : (fallback ?? t('bans.unknownField'))
  }

  const schema = useMemo(
    () =>
      z
        .object({
          type: z.enum(['ip', 'customField']),
          fieldId: z.string(),
          value: z.string().trim().min(1, t('validation.required')).max(80, t('validation.tooLong', { max: 80 })),
          reason: z.string().trim().min(1, t('validation.required')).max(200, t('validation.tooLong', { max: 200 })),
        })
        .superRefine((v, ctx) => {
          if (v.type === 'ip' && v.value && !IPV4.test(v.value) && !(v.value.includes(':') && IPV6.test(v.value))) {
            ctx.addIssue({ code: 'custom', path: ['value'], message: t('bans.errors.invalidIp') })
          }
          if (v.type === 'customField' && !v.fieldId) ctx.addIssue({ code: 'custom', path: ['fieldId'], message: t('validation.required') })
        }),
    [t],
  )
  const { control, register, handleSubmit, reset, watch, formState } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { type: 'ip', fieldId: '', value: '', reason: '' },
  })
  const type = watch('type')
  const e = formState.errors

  const submit = handleSubmit(async (values) => {
    try {
      await create.mutateAsync({ type: values.type, value: values.value.trim(), reason: values.reason.trim(), ...(values.type === 'customField' ? { fieldId: values.fieldId } : {}) })
      toast.success(t('bans.added'))
      reset({ type: values.type, fieldId: values.fieldId, value: '', reason: '' })
    } catch (error) {
      toast.error(errors.text(error))
    }
  })

  const columns: Column<BannedClient>[] = [
    {
      id: 'target',
      header: t('bans.columns.rule'),
      cell: (row) => (
        <div className="min-w-0">
          <p className="truncate font-mono text-[13px] text-ink">{row.value}</p>
          <p className="mt-0.5">
            <Pill tone={row.type === 'ip' ? 'info' : 'accent'} size="sm">
              {row.type === 'ip' ? t('bans.types.ip') : fieldName(row.fieldId, row.fieldLabel)}
            </Pill>
          </p>
        </div>
      ),
    },
    { id: 'reason', header: t('bans.columns.reason'), cell: (row) => <span className="text-[13px] text-ink">{row.reason}</span> },
    {
      id: 'by',
      header: t('bans.columns.by'),
      hideBelow: 'md',
      cell: (row) => (
        <div className="text-[13px]">
          <p className="text-ink">{row.createdBy}</p>
          <p className="text-muted">{formatDate(row.createdAt)}</p>
        </div>
      ),
    },
    {
      id: 'actions',
      header: <span className="sr-only">{t('bans.columns.actions')}</span>,
      align: 'right',
      width: '56px',
      cell: (row) => <IconButton label={t('bans.remove')} variant="ghost" size="sm" icon={<Trash2 strokeWidth={1.75} />} onClick={() => setDeleting(row)} />,
    },
  ]

  return (
    <>
      <Modal
        open
        onOpenChange={(open) => !open && onClose()}
        size="xl"
        title={t('bans.title')}
        description={t('bans.description')}
        footer={
          <Button variant="ghost" onClick={onClose}>
            {tc('actions.close')}
          </Button>
        }
      >
        <div className="flex flex-col gap-6">
          <form id={FORM_ID} onSubmit={(event) => void submit(event)} noValidate className="flex flex-col gap-4 rounded-ui border border-line bg-sunken p-4">
            <p className="font-display text-[15px] font-semibold text-ink">{t('bans.addTitle')}</p>
            <Controller
              control={control}
              name="type"
              render={({ field }) => (
                <SegmentedControl
                  aria-label={t('bans.kind')}
                  value={field.value}
                  onChange={field.onChange}
                  options={[
                    { value: 'ip', label: t('bans.types.ip') },
                    { value: 'customField', label: t('bans.types.field') },
                  ]}
                />
              )}
            />
            <div className="grid gap-4 sm:grid-cols-2">
              {type === 'customField' ? (
                <Field label={t('bans.field')} error={e.fieldId?.message} htmlFor="ban-field" required>
                  <Controller
                    control={control}
                    name="fieldId"
                    render={({ field }) => (
                      <Select
                        id="ban-field"
                        value={field.value || undefined}
                        onValueChange={(value) => field.onChange(value)}
                        placeholder={t('bans.fieldPlaceholder')}
                        invalid={!!e.fieldId}
                        options={fields.filter((row) => row.type !== 'select').map((row) => ({ value: row.id, label: pickText(row.label, lang) }))}
                      />
                    )}
                  />
                </Field>
              ) : null}
              <Field label={type === 'ip' ? t('bans.ip') : t('bans.value')} hint={type === 'ip' ? t('bans.ipHint') : t('bans.valueHint')} error={e.value?.message} htmlFor="ban-value" required>
                <Input id="ban-value" mono invalid={!!e.value} placeholder={type === 'ip' ? '203.0.113.7' : '+995 555 00 00 00'} autoComplete="off" {...register('value')} />
              </Field>
              <Field label={t('bans.reason')} error={e.reason?.message} htmlFor="ban-reason" required className={type === 'ip' ? '' : 'sm:col-span-2'}>
                <Input id="ban-reason" invalid={!!e.reason} maxLength={200} autoComplete="off" {...register('reason')} />
              </Field>
            </div>
            <div>
              <Button type="submit" variant="outline" leftIcon={<Ban className="size-4" strokeWidth={1.75} />} loading={create.isPending}>
                {t('bans.add')}
              </Button>
            </div>
          </form>

          <DataTable<BannedClient>
            columns={columns}
            rows={query.data ?? []}
            rowKey={(row) => row.id}
            loading={query.isLoading}
            pageSize={8}
            caption={t('bans.title')}
            empty={query.isError ? { title: t('bans.loadError'), description: t('bans.loadErrorHint') } : { title: t('bans.emptyTitle'), description: t('bans.emptyDescription') }}
          />
        </div>
      </Modal>

      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(open) => !open && setDeleting(null)}
        tone="danger"
        title={t('bans.removeTitle')}
        description={t('bans.removeDescription', { value: deleting?.value ?? '' })}
        confirmLabel={t('bans.removeConfirm')}
        onConfirm={async () => {
          if (!deleting) return
          try {
            await remove.mutateAsync(deleting.id)
            toast.success(t('bans.removed'))
          } catch (error) {
            toast.error(errors.text(error))
            throw error
          }
        }}
      />
    </>
  )
}
