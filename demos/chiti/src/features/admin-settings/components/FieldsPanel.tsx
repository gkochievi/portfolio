import { zodResolver } from '@hookform/resolvers/zod'
import { Link2, Pencil, Plus, Trash2, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Controller, useFieldArray, useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { z } from 'zod'

import { Button, ConfirmDialog, EmptyState, ErrorState, Field, IconButton, Input, LocalizedTextField, Modal, Pill, Select, Skeleton, Switch, toast } from '@/components/ui'
import { pickText } from '@/lib/format'
import type { CustomField, CustomFieldType } from '@/types'

import { useCustomFields, useFieldMutations, type FieldInput } from '../api'
import { cleanText, locError, localizedSchema, textValue, useSettingsErrors } from '../shared'

const FORM_ID = 'field-form'
const TYPES: CustomFieldType[] = ['text', 'number', 'email', 'phone', 'select']
const MAX_OPTIONS = 20

interface FormValues {
  label: { ka: string; en: string; ru?: string }
  type: CustomFieldType
  placeholder: { ka: string; en: string; ru?: string }
  options: { value: string; label: { ka: string; en: string; ru?: string } }[]
  required: boolean
  enabled: boolean
  groupBy: boolean
}

function FieldForm({ field, onBack, onSaved }: { field: CustomField | null; onBack: () => void; onSaved: () => void }) {
  const { t } = useTranslation('adminSettings')
  const tc = useTranslation().t
  const { create, update } = useFieldMutations()
  const errors = useSettingsErrors()

  const schema = useMemo(
    () =>
      z
        .object({
          label: localizedSchema(t, ['ka', 'en'], 60),
          type: z.enum(['text', 'number', 'email', 'phone', 'select']),
          placeholder: localizedSchema(t, [], 80),
          options: z.array(z.object({ value: z.string(), label: localizedSchema(t, ['ka', 'en'], 60) })),
          required: z.boolean(),
          enabled: z.boolean(),
          groupBy: z.boolean(),
        })
        .superRefine((value, ctx) => {
          if (value.type === 'select' && value.options.length === 0) ctx.addIssue({ code: 'custom', path: ['options'], message: t('fields.errors.needOption') })
          if (value.groupBy && !value.enabled) ctx.addIssue({ code: 'custom', path: ['groupBy'], message: t('fields.errors.groupByDisabled') })
        }),
    [t],
  )

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      label: textValue(field?.label),
      type: field?.type ?? 'text',
      placeholder: textValue(field?.placeholder),
      options: (field?.options ?? []).map((option) => ({ value: option.value, label: textValue(option.label) })),
      required: field?.required ?? false,
      enabled: field?.enabled ?? true,
      groupBy: field?.groupBy ?? false,
    },
  })
  const { control, register, handleSubmit, watch, formState } = form
  const options = useFieldArray({ control, name: 'options' })
  const type = watch('type')
  const e = formState.errors
  const saving = create.isPending || update.isPending

  const submit = handleSubmit(async (values) => {
    const input: FieldInput = {
      label: cleanText(values.label),
      type: values.type,
      placeholder: cleanText(values.placeholder),
      options: values.type === 'select' ? values.options.map((option) => ({ value: option.value, label: cleanText(option.label) })) : [],
      required: values.required,
      enabled: values.enabled,
      groupBy: values.groupBy,
    }
    try {
      if (field) await update.mutateAsync({ id: field.id, patch: input })
      else await create.mutateAsync(input)
      toast.success(t(field ? 'fields.updated' : 'fields.created'))
      onSaved()
    } catch (error) {
      toast.error(errors.text(error))
    }
  })

  return (
    <Modal
      open
      onOpenChange={(open) => !open && onBack()}
      size="lg"
      title={field ? t('fields.editTitle') : t('fields.newTitle')}
      description={t('fields.formDescription')}
      footer={
        <>
          <Button variant="ghost" onClick={onBack}>
            {t('fields.backToList')}
          </Button>
          <Button type="submit" form={FORM_ID} loading={saving}>
            {tc('actions.save')}
          </Button>
        </>
      }
    >
      <form id={FORM_ID} onSubmit={(event) => void submit(event)} noValidate className="flex flex-col gap-5">
        <Field label={t('fields.label')} hint={t('fields.labelHint')} error={locError(e.label)} required>
          <Controller control={control} name="label" render={({ field: f }) => <LocalizedTextField maxLength={60} value={f.value} onChange={f.onChange} invalid={!!e.label} />} />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t('fields.type')} htmlFor="field-type">
            <Controller
              control={control}
              name="type"
              render={({ field: f }) => (
                <Select id="field-type" value={f.value} onValueChange={(value) => f.onChange(value)} options={TYPES.map((value) => ({ value, label: t(`fields.types.${value}`) }))} />
              )}
            />
          </Field>
        </div>

        {type === 'select' ? (
          <Field label={t('fields.options')} hint={t('fields.optionsHint')} error={e.options?.message ?? e.options?.root?.message}>
            <div className="flex flex-col gap-2">
              {options.fields.map((row, index) => (
                <div key={row.id} className="grid grid-cols-[1fr_auto] items-start gap-2 sm:grid-cols-[1fr_1fr_auto]">
                  <Input aria-label={`${t('fields.optionKa')} ${index + 1}`} lang="ka" placeholder={t('fields.optionKa')} invalid={!!e.options?.[index]?.label?.ka} {...register(`options.${index}.label.ka`)} />
                  <IconButton label={t('fields.removeOption')} variant="ghost" size="sm" className="sm:order-last" icon={<X strokeWidth={1.75} />} onClick={() => options.remove(index)} />
                  <Input aria-label={`${t('fields.optionEn')} ${index + 1}`} lang="en" placeholder={t('fields.optionEn')} invalid={!!e.options?.[index]?.label?.en} className="col-span-2 sm:col-span-1" {...register(`options.${index}.label.en`)} />
                  {e.options?.[index]?.label ? (
                    <p role="alert" className="col-span-full text-[13px] text-danger">
                      {locError(e.options[index]?.label)}
                    </p>
                  ) : null}
                </div>
              ))}
              <div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  leftIcon={<Plus className="size-4" strokeWidth={1.75} />}
                  disabled={options.fields.length >= MAX_OPTIONS}
                  onClick={() => options.append({ value: '', label: { ka: '', en: '', ru: '' } })}
                >
                  {t('fields.addOption')}
                </Button>
              </div>
            </div>
          </Field>
        ) : null}

        <Field label={t('fields.placeholder')} hint={t('fields.placeholderHint')} error={locError(e.placeholder)}>
          <Controller control={control} name="placeholder" render={({ field: f }) => <LocalizedTextField withRu maxLength={80} required={[]} value={f.value} onChange={f.onChange} invalid={!!e.placeholder} />} />
        </Field>

        <div className="divide-y divide-line rounded-ui border border-line bg-panel px-4 [&>*]:py-3">
          <Controller control={control} name="required" render={({ field: f }) => <Switch labelFirst checked={f.value} onCheckedChange={f.onChange} label={t('fields.required')} description={t('fields.requiredHint')} />} />
          <Controller control={control} name="enabled" render={({ field: f }) => <Switch labelFirst checked={f.value} onCheckedChange={f.onChange} label={t('fields.enabled')} description={t('fields.enabledHint')} />} />
          <div>
            <Controller control={control} name="groupBy" render={({ field: f }) => <Switch labelFirst checked={f.value} onCheckedChange={f.onChange} label={t('fields.groupBy')} description={t('fields.groupByHint')} />} />
            {e.groupBy?.message ? (
              <p role="alert" className="mt-1.5 text-[13px] text-danger">
                {e.groupBy.message}
              </p>
            ) : null}
          </div>
        </div>
      </form>
    </Modal>
  )
}

export function FieldsPanel({ onClose }: { onClose: () => void }) {
  const { t, i18n } = useTranslation('adminSettings')
  const tc = useTranslation().t
  const lang = i18n.language.startsWith('ka') ? 'ka' : 'en'
  const query = useCustomFields()
  const { update, remove } = useFieldMutations()
  const errors = useSettingsErrors()
  const [editing, setEditing] = useState<CustomField | 'new' | null>(null)
  const [deleting, setDeleting] = useState<CustomField | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

  const rows = query.data ?? []

  const toggle = async (row: CustomField, enabled: boolean) => {
    setBusyId(row.id)
    try {
      // A disabled field cannot be the "previous chats" key.
      await update.mutateAsync({ id: row.id, patch: { enabled, ...(enabled ? {} : { groupBy: false }) } })
    } catch (error) {
      toast.error(errors.text(error))
    } finally {
      setBusyId(null)
    }
  }

  if (editing) {
    return <FieldForm field={editing === 'new' ? null : editing} onBack={() => setEditing(null)} onSaved={() => setEditing(null)} />
  }

  return (
    <>
      <Modal
        open
        onOpenChange={(open) => !open && onClose()}
        size="lg"
        title={t('fields.title')}
        description={t('fields.description')}
        footer={
          <Button variant="ghost" onClick={onClose}>
            {tc('actions.close')}
          </Button>
        }
      >
        {query.isError ? (
          <ErrorState title={t('fields.loadError')} onRetry={() => void query.refetch()} retryLabel={tc('actions.retry')} />
        ) : query.isLoading ? (
          <div className="flex flex-col gap-2" aria-busy>
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-[13px] text-muted">{t('fields.count', { count: rows.length, enabled: rows.filter((row) => row.enabled).length })}</p>
              <Button size="sm" leftIcon={<Plus className="size-4" strokeWidth={1.75} />} onClick={() => setEditing('new')}>
                {t('fields.add')}
              </Button>
            </div>
            {rows.length === 0 ? (
              <EmptyState compact title={t('fields.emptyTitle')} description={t('fields.emptyDescription')} />
            ) : (
              <ul className="divide-y divide-line rounded-ui border border-line bg-panel">
                {rows.map((row) => (
                  <li key={row.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 px-3 py-3">
                    <div className="min-w-0 flex-1 basis-48">
                      <p className={row.enabled ? 'truncate text-sm font-medium text-ink' : 'truncate text-sm font-medium text-muted'}>{pickText(row.label, lang)}</p>
                      <div className="mt-1 flex flex-wrap items-center gap-1.5">
                        <Pill tone="neutral" size="sm">
                          {t(`fields.types.${row.type}`)}
                        </Pill>
                        {row.required ? (
                          <Pill tone="warning" size="sm">
                            {t('fields.requiredBadge')}
                          </Pill>
                        ) : null}
                        {row.groupBy ? (
                          <Pill tone="accent" size="sm" icon={<Link2 className="size-3" strokeWidth={2} />}>
                            {t('fields.groupByBadge')}
                          </Pill>
                        ) : null}
                        {row.type === 'select' ? (
                          <span className="text-[12px] text-muted">{t('fields.optionCount', { count: row.options.length })}</span>
                        ) : null}
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Switch size="sm" checked={row.enabled} disabled={busyId === row.id} onCheckedChange={(next) => void toggle(row, next)} aria-label={t('fields.toggle', { name: pickText(row.label, lang) })} />
                      <IconButton label={t('fields.edit')} variant="ghost" size="sm" icon={<Pencil strokeWidth={1.75} />} onClick={() => setEditing(row)} />
                      <IconButton label={t('fields.delete')} variant="ghost" size="sm" icon={<Trash2 strokeWidth={1.75} />} onClick={() => setDeleting(row)} />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(open) => !open && setDeleting(null)}
        tone="danger"
        title={t('fields.deleteTitle')}
        description={t('fields.deleteDescription', { name: deleting ? pickText(deleting.label, lang) : '' })}
        confirmLabel={tc('actions.delete')}
        onConfirm={async () => {
          if (!deleting) return
          try {
            await remove.mutateAsync(deleting.id)
            toast.success(t('fields.deleted'))
          } catch (error) {
            toast.error(errors.text(error))
            throw error
          }
        }}
      />
    </>
  )
}
