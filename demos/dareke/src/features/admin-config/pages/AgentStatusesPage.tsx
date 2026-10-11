/** /admin/agent-statuses - the states operators can be in. */
import { Lock, Pencil, Plus, Trash2 } from 'lucide-react'
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
  PageHeader,
  Segmented,
  ToneDot,
  ToneSwatchPicker,
  Tooltip,
  type Column,
} from '@/components/ui'
import { useLocalized } from '@/lib/localized'
import { toast } from '@/lib/toast'
import type { AgentStatus, AgentStatusType, Tone } from '@/types'

import { useDeleteStatus, useSaveStatus, useStatuses, type StatusInput } from '../api'
import { LoadError, ReadOnlyNote, useCanEdit, useFieldErrors, useToastError, YesNo } from '../components/shared'

const TYPES: AgentStatusType[] = ['working', 'paused', 'offline']

interface FormState {
  nameEn: string
  nameKa: string
  type: AgentStatusType
  timeout: string
  autoReturn: boolean
  color: Tone
}

const blank: FormState = { nameEn: '', nameKa: '', type: 'paused', timeout: '0', autoReturn: false, color: 'warning' }

function StatusDialog({ open, onOpenChange, status }: { open: boolean; onOpenChange: (open: boolean) => void; status: AgentStatus | null }) {
  const { t } = useTranslation('config')
  const { t: tc } = useTranslation()
  const save = useSaveStatus()
  const mapErrors = useFieldErrors()
  const toastError = useToastError()
  const [form, setForm] = useState<FormState>(() =>
    status
      ? {
          nameEn: status.displayName.en,
          nameKa: status.displayName.ka === status.displayName.en ? '' : status.displayName.ka,
          type: status.type,
          timeout: String(status.timeoutSeconds),
          autoReturn: status.autoReturn,
          color: status.color,
        }
      : blank,
  )
  const [errors, setErrors] = useState<Record<string, string>>({})
  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm((f) => ({ ...f, [key]: value }))

  const submit = (event?: FormEvent) => {
    event?.preventDefault()
    const next: Record<string, string> = {}
    if (!form.nameEn.trim()) next['displayName.en'] = t('server.required')
    const timeout = Number(form.timeout || 0)
    if (!Number.isInteger(timeout) || timeout < 0 || timeout > 86_400) next.timeoutSeconds = t('server.timeoutRange')
    setErrors(next)
    if (Object.keys(next).length) return
    const input: StatusInput = {
      displayName: { en: form.nameEn.trim(), ka: form.nameKa.trim() || form.nameEn.trim() },
      type: form.type,
      timeoutSeconds: timeout,
      autoReturn: timeout > 0 && form.autoReturn,
      color: form.color,
    }
    save.mutate(
      { id: status?.id, input },
      {
        onSuccess: () => {
          toast.success(status ? t('statuses.saved') : t('statuses.created'))
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

  const timeoutOn = Number(form.timeout || 0) > 0
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={status ? t('statuses.editTitle') : t('statuses.newTitle')}
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
        <Field label={t('shared.nameEn')} required error={errors['displayName.en']} htmlFor="st-name-en">
          <Input id="st-name-en" value={form.nameEn} onChange={(e) => set('nameEn', e.target.value)} invalid={Boolean(errors['displayName.en'])} autoFocus />
        </Field>
        <Field label={t('shared.nameKa')} hint={t('shared.nameKaHint')} htmlFor="st-name-ka">
          <Input id="st-name-ka" lang="ka" value={form.nameKa} onChange={(e) => set('nameKa', e.target.value)} />
        </Field>
        <Field label={t('statuses.type')} error={errors.type} className="sm:col-span-2">
          <Segmented
            value={form.type}
            onChange={(v) => set('type', v as AgentStatusType)}
            aria-label={t('statuses.type')}
            options={TYPES.map((type) => ({ value: type, label: tc(`statusType.${type}`), disabled: Boolean(status?.isSystem) && type !== status?.type }))}
          />
          {status?.isSystem && <p className="text-xs text-muted">{t('statuses.systemNote')}</p>}
        </Field>
        <Field label={t('statuses.timeout')} hint={t('statuses.timeoutHint')} error={errors.timeoutSeconds} htmlFor="st-timeout">
          <Input
            id="st-timeout"
            type="number"
            inputMode="numeric"
            min={0}
            step={1}
            mono
            value={form.timeout}
            onChange={(e) => set('timeout', e.target.value)}
            invalid={Boolean(errors.timeoutSeconds)}
            suffix={<span className="text-xs text-muted">{t('statuses.seconds', { count: Number(form.timeout || 0) }).replace(/^[\d.]+\s*/, '')}</span>}
          />
        </Field>
        <div className="flex items-end pb-1">
          <Checkbox
            checked={timeoutOn && form.autoReturn}
            disabled={!timeoutOn}
            onCheckedChange={(v) => set('autoReturn', v)}
            label={t('statuses.autoReturn')}
            description={t('statuses.autoReturnHint')}
          />
        </div>
        <Field label={t('statuses.color')} className="sm:col-span-2">
          <ToneSwatchPicker value={form.color} onChange={(tone) => set('color', tone)} />
        </Field>
        <button type="submit" hidden />
      </form>
    </Dialog>
  )
}

export default function AgentStatusesPage() {
  const { t } = useTranslation('config')
  const { t: tc } = useTranslation()
  const l = useLocalized()
  const canEdit = useCanEdit()
  const query = useStatuses()
  const remove = useDeleteStatus()
  const toastError = useToastError()
  const [editing, setEditing] = useState<AgentStatus | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [dialogKey, setDialogKey] = useState(0)
  const [deleting, setDeleting] = useState<AgentStatus | null>(null)

  const openDialog = (status: AgentStatus | null) => {
    setEditing(status)
    setDialogKey((k) => k + 1)
    setDialogOpen(true)
  }

  const columns: Column<AgentStatus>[] = [
    {
      key: 'name',
      header: t('statuses.cols.name'),
      sortValue: (s) => l(s.displayName),
      cell: (s) => (
        <div className="flex min-w-0 items-center gap-2.5">
          <ToneDot tone={s.color} size={10} />
          <div className="min-w-0">
            <div className="truncate font-medium text-ink">{l(s.displayName)}</div>
            <div className="truncate font-mono text-xs text-muted">{s.name}</div>
          </div>
        </div>
      ),
    },
    {
      key: 'type',
      header: t('statuses.cols.type'),
      sortValue: (s) => s.type,
      cell: (s) => (
        <Badge tone={s.type === 'working' ? 'success' : s.type === 'paused' ? 'warning' : 'muted'} variant={s.type === 'offline' ? 'outline' : 'soft'}>
          {tc(`statusType.${s.type}`)}
        </Badge>
      ),
    },
    {
      key: 'timeout',
      header: t('statuses.cols.timeout'),
      align: 'right',
      sortValue: (s) => s.timeoutSeconds,
      cell: (s) =>
        s.timeoutSeconds > 0 ? (
          <span className="font-mono tabular">{t('statuses.seconds', { count: s.timeoutSeconds })}</span>
        ) : (
          <span className="text-muted">{t('statuses.noTimeout')}</span>
        ),
    },
    { key: 'auto', header: t('statuses.cols.autoReturn'), align: 'center', cell: (s) => <YesNo value={s.autoReturn && s.timeoutSeconds > 0} />, hideOnMobile: true },
    {
      key: 'flags',
      header: t('statuses.cols.flags'),
      hideOnMobile: true,
      cell: (s) => (
        <div className="flex flex-wrap gap-1">
          {s.isDefault && <Badge tone="success" variant="outline">{t('statuses.default')}</Badge>}
          {s.isSystem && (
            <Badge tone="ink" variant="outline" icon={<Lock size={12} strokeWidth={1.75} />}>
              {t('statuses.system')}
            </Badge>
          )}
        </div>
      ),
    },
  ]
  if (canEdit)
    columns.push({
      key: 'actions',
      header: '',
      align: 'right',
      width: '96px',
      cell: (s) => (
        <div className="flex justify-end gap-1">
          <IconButton label={tc('actions.edit')} icon={<Pencil size={16} strokeWidth={1.75} />} size="sm" onClick={() => openDialog(s)} />
          {!(s.isDefault || s.isSystem) ? (
            <IconButton label={tc('actions.delete')} icon={<Trash2 size={16} strokeWidth={1.75} />} size="sm" onClick={() => setDeleting(s)} />
          ) : (
            <Tooltip content={t('statuses.protected')}>
              <span className="inline-flex h-8 w-8 items-center justify-center text-muted/60" aria-label={t('statuses.protected')}>
                <Lock size={14} strokeWidth={1.75} />
              </span>
            </Tooltip>
          )}
        </div>
      ),
    })

  return (
    <section>
      <PageHeader
        eyebrow={t('eyebrow')}
        title={t('pages.AgentStatusesPage')}
        description={t('statuses.description')}
        actions={
          canEdit && (
            <Button variant="dial" icon={<Plus size={18} strokeWidth={1.75} />} onClick={() => openDialog(null)}>
              {t('statuses.add')}
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
          rowKey={(s) => s.id}
          loading={query.isLoading}
          pageSize={0}
          empty={
            <div className="py-10 text-center">
              <p className="font-medium text-ink">{t('statuses.empty')}</p>
              <p className="text-sm text-muted">{t('statuses.emptyHint')}</p>
            </div>
          }
        />
      )}
      {query.data && <p className="mt-2 text-xs text-muted">{t('statuses.count', { count: query.data.length })}</p>}

      {dialogOpen && <StatusDialog key={dialogKey} open={dialogOpen} onOpenChange={setDialogOpen} status={editing} />}

      <ConfirmDialog
        open={Boolean(deleting)}
        onOpenChange={(open) => !open && setDeleting(null)}
        title={t('statuses.deleteTitle')}
        description={deleting ? t('statuses.deleteBody', { name: l(deleting.displayName) }) : undefined}
        confirmLabel={tc('actions.delete')}
        tone="danger"
        loading={remove.isPending}
        onConfirm={() =>
          deleting &&
          remove.mutate(deleting.id, {
            onSuccess: () => {
              toast.success(t('statuses.deleted'))
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
