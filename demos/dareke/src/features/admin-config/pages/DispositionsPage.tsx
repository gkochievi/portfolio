/** /admin/dispositions - the outcomes an operator records after each call. */
import { Pencil, Plus, Trash2 } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'

import {
  Badge,
  Button,
  Checkbox,
  ConfirmDialog,
  DataTable,
  Dialog,
  Field,
  IconButton,
  Input,
  Kbd,
  PageHeader,
  ToneDot,
  ToneSwatchPicker,
  type Column,
} from '@/components/ui'
import { useLocalized } from '@/lib/localized'
import { toast } from '@/lib/toast'
import type { Disposition, Tone } from '@/types'

import { useDeleteDisposition, useDispositions, useSaveDisposition, type DispositionInput } from '../api'
import { LoadError, ReadOnlyNote, useCanEdit, useFieldErrors, useToastError, YesNo } from '../components/shared'

interface FormState {
  code: string
  nameEn: string
  nameKa: string
  color: Tone
  isFinal: boolean
  scheduleCallback: boolean
  addToDnc: boolean
}

const blank: FormState = { code: '', nameEn: '', nameKa: '', color: 'info', isFinal: false, scheduleCallback: false, addToDnc: false }

const toCode = (value: string) => value.toUpperCase().replace(/[^A-Z0-9_ ]/g, '').replace(/\s+/g, '_')

function DispositionDialog({ open, onOpenChange, disposition }: { open: boolean; onOpenChange: (open: boolean) => void; disposition: Disposition | null }) {
  const { t } = useTranslation('config')
  const { t: tc } = useTranslation()
  const save = useSaveDisposition()
  const mapErrors = useFieldErrors()
  const toastError = useToastError()
  const [form, setForm] = useState<FormState>(() =>
    disposition
      ? {
          code: disposition.code,
          nameEn: disposition.name.en,
          nameKa: disposition.name.ka === disposition.name.en ? '' : disposition.name.ka,
          color: disposition.color,
          isFinal: disposition.isFinal,
          scheduleCallback: disposition.scheduleCallback,
          addToDnc: disposition.addToDnc,
        }
      : blank,
  )
  const [errors, setErrors] = useState<Record<string, string>>({})
  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm((f) => ({ ...f, [key]: value }))

  const submit = (event?: FormEvent) => {
    event?.preventDefault()
    const next: Record<string, string> = {}
    const code = toCode(form.code.trim())
    if (!code) next.code = t('server.required')
    else if (!/^[A-Z][A-Z0-9_]{1,31}$/.test(code)) next.code = t('server.codeFormat')
    if (!form.nameEn.trim()) next['name.en'] = t('server.required')
    setErrors(next)
    if (Object.keys(next).length) return
    const input: DispositionInput = {
      code,
      name: { en: form.nameEn.trim(), ka: form.nameKa.trim() || form.nameEn.trim() },
      color: form.color,
      isFinal: form.isFinal,
      scheduleCallback: form.scheduleCallback,
      addToDnc: form.addToDnc,
    }
    save.mutate(
      { id: disposition?.id, input },
      {
        onSuccess: () => {
          toast.success(disposition ? t('dispositions.saved') : t('dispositions.created'))
          onOpenChange(false)
        },
        onError: (error) => {
          const fields = mapErrors(error)
          if (Object.keys(fields).length) setErrors(fields)
          else toastError(error)
        },
      },
    )
  }

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={disposition ? t('dispositions.editTitle') : t('dispositions.newTitle')}
      footer={
        <>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            {tc('actions.cancel')}
          </Button>
          <Button variant="dial" loading={save.isPending} onClick={() => submit()}>
            {tc('actions.save')}
          </Button>
        </>
      }
    >
      <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
        <Field label={t('dispositions.code')} hint={t('dispositions.codeHint')} required error={errors.code} htmlFor="dp-code" className="sm:col-span-2">
          <Input id="dp-code" mono value={form.code} onChange={(e) => set('code', toCode(e.target.value))} invalid={Boolean(errors.code)} autoFocus maxLength={32} />
        </Field>
        <Field label={t('shared.nameEn')} required error={errors['name.en']} htmlFor="dp-name-en">
          <Input id="dp-name-en" value={form.nameEn} onChange={(e) => set('nameEn', e.target.value)} invalid={Boolean(errors['name.en'])} />
        </Field>
        <Field label={t('shared.nameKa')} hint={t('shared.nameKaHint')} htmlFor="dp-name-ka">
          <Input id="dp-name-ka" lang="ka" value={form.nameKa} onChange={(e) => set('nameKa', e.target.value)} />
        </Field>
        <Field label={t('dispositions.color')} className="sm:col-span-2">
          <ToneSwatchPicker value={form.color} onChange={(tone) => set('color', tone)} />
        </Field>
        <div className="flex flex-col gap-3 sm:col-span-2">
          <Checkbox checked={form.isFinal} onCheckedChange={(v) => set('isFinal', v)} label={t('dispositions.isFinal')} />
          <Checkbox
            checked={form.scheduleCallback}
            onCheckedChange={(v) => set('scheduleCallback', v)}
            label={t('dispositions.scheduleCallback')}
            description={t('dispositions.scheduleCallbackHint')}
          />
          <Checkbox checked={form.addToDnc} onCheckedChange={(v) => set('addToDnc', v)} label={t('dispositions.addToDnc')} description={t('dispositions.addToDncHint')} />
        </div>
        <button type="submit" hidden />
      </form>
    </Dialog>
  )
}

export default function DispositionsPage() {
  const { t } = useTranslation('config')
  const { t: tc } = useTranslation()
  const l = useLocalized()
  const canEdit = useCanEdit()
  const query = useDispositions()
  const remove = useDeleteDisposition()
  const toastError = useToastError()
  const [editing, setEditing] = useState<Disposition | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [dialogKey, setDialogKey] = useState(0)
  const [deleting, setDeleting] = useState<Disposition | null>(null)

  const openDialog = (disposition: Disposition | null) => {
    setEditing(disposition)
    setDialogKey((k) => k + 1)
    setDialogOpen(true)
  }

  const columns: Column<Disposition>[] = [
    {
      key: 'code',
      header: t('dispositions.cols.code'),
      sortValue: (d) => d.code,
      cell: (d) => (
        <span className="inline-flex items-center gap-2">
          <ToneDot tone={d.color} size={10} />
          <span className="font-mono text-[13px] font-medium uppercase tracking-wide text-ink">{d.code}</span>
        </span>
      ),
    },
    { key: 'name', header: t('dispositions.cols.name'), sortValue: (d) => l(d.name), cell: (d) => <span className="text-ink">{l(d.name)}</span> },
    {
      key: 'tone',
      header: t('dispositions.color'),
      hideOnMobile: true,
      cell: (d) => <Badge tone={d.color}>{tc(`tones.${d.color}`)}</Badge>,
    },
    { key: 'final', header: t('dispositions.cols.final'), align: 'center', cell: (d) => <YesNo value={d.isFinal} /> },
    { key: 'callback', header: t('dispositions.cols.callback'), align: 'center', hideOnMobile: true, cell: (d) => <YesNo value={d.scheduleCallback} /> },
    { key: 'dnc', header: t('dispositions.cols.dnc'), align: 'center', hideOnMobile: true, cell: (d) => <YesNo value={d.addToDnc} /> },
    {
      key: 'order',
      header: t('dispositions.cols.order'),
      align: 'center',
      sortValue: (d) => d.sortOrder,
      cell: (d) => (
        <span className="inline-flex items-center gap-2">
          <span className="font-mono tabular text-muted">{d.sortOrder}</span>
          {d.sortOrder <= 9 && <Kbd>{d.sortOrder}</Kbd>}
        </span>
      ),
    },
  ]
  if (canEdit)
    columns.push({
      key: 'actions',
      header: '',
      align: 'right',
      width: '96px',
      cell: (d) => (
        <div className="flex justify-end gap-1">
          <IconButton label={tc('actions.edit')} icon={<Pencil size={16} strokeWidth={1.75} />} size="sm" onClick={() => openDialog(d)} />
          <IconButton label={tc('actions.delete')} icon={<Trash2 size={16} strokeWidth={1.75} />} size="sm" onClick={() => setDeleting(d)} />
        </div>
      ),
    })

  return (
    <section>
      <PageHeader
        eyebrow={t('eyebrow')}
        title={t('pages.DispositionsPage')}
        description={t('dispositions.description')}
        actions={
          canEdit && (
            <Button variant="dial" icon={<Plus size={18} strokeWidth={1.75} />} onClick={() => openDialog(null)}>
              {t('dispositions.add')}
            </Button>
          )
        }
      />
      {!canEdit && <ReadOnlyNote />}
      {query.isError ? (
        <LoadError error={query.error} onRetry={() => void query.refetch()} />
      ) : (
        <DataTable
          rows={query.data ?? []}
          columns={columns}
          rowKey={(d) => d.id}
          loading={query.isLoading}
          pageSize={0}
          empty={
            <div className="py-10 text-center">
              <p className="font-medium text-ink">{t('dispositions.empty')}</p>
              <p className="text-sm text-muted">{t('dispositions.emptyHint')}</p>
            </div>
          }
        />
      )}
      {query.data && <p className="mt-2 text-xs text-muted">{t('dispositions.count', { count: query.data.length })}</p>}

      {dialogOpen && <DispositionDialog key={dialogKey} open={dialogOpen} onOpenChange={setDialogOpen} disposition={editing} />}

      <ConfirmDialog
        open={Boolean(deleting)}
        onOpenChange={(open) => !open && setDeleting(null)}
        title={t('dispositions.deleteTitle')}
        description={deleting ? t('dispositions.deleteBody', { name: l(deleting.name) }) : undefined}
        confirmLabel={tc('actions.delete')}
        tone="danger"
        loading={remove.isPending}
        onConfirm={() =>
          deleting &&
          remove.mutate(deleting.id, {
            onSuccess: () => {
              toast.success(t('dispositions.deleted'))
              setDeleting(null)
            },
            onError: (error) => {
              toastError(error)
              setDeleting(null)
            },
          })
        }
      />
    </section>
  )
}
