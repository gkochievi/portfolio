/** /admin/dnc - the global do-not-call list: search, add, remove, import. */
import { FileText, Plus, Trash2, Upload } from 'lucide-react'
import type { TFunction } from 'i18next'
import { useRef, useState, type DragEvent, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'

import { Badge, Button, ConfirmDialog, DataTable, Dialog, Field, IconButton, Input, PageHeader, SearchInput, Toolbar, type Column } from '@/components/ui'
import { cn } from '@/lib/cn'
import { formatDate, formatPhone } from '@/lib/format'
import { useLocalized } from '@/lib/localized'
import { toast } from '@/lib/toast'
import type { DncEntryView, DncSource } from '@/types'

import { useAddDnc, useDnc, useImportDnc, useRemoveDnc } from '../api'
import { LoadError, ReadOnlyNote, useCanEdit, useFieldErrors, useToastError } from '../components/shared'

const SOURCE_TONE: Record<DncSource, 'ink' | 'danger' | 'info' | 'muted'> = {
  MANUAL: 'ink',
  CUSTOMER_REQUEST: 'danger',
  DISPOSITION: 'info',
  IMPORT: 'muted',
}

const REASON_KEYS: Record<string, string> = {
  'Customer asked not to be called again': 'customerAsked',
  'Requested removal during a survey call': 'surveyRemoval',
  'Opted out by SMS reply': 'smsOptOut',
  'Imported from the client opt-out list': 'clientList',
  'Complaint escalated by the client': 'complaint',
  'Number belongs to a business line': 'businessLine',
  'Customer registered a written objection': 'writtenObjection',
  'Added manually': 'manual',
}

/** Seeded and system-written reasons are English strings; show them in the UI language. */
const reasonLabel = (reason: string, t: TFunction): string => {
  const key = REASON_KEYS[reason]
  if (key) return t(`dnc.reasons.${key}`)
  const imported = /^Imported from (.+)$/.exec(reason)
  if (imported) return t('dnc.reasons.importedFrom', { file: imported[1] })
  return reason
}

const matches = (entry: DncEntryView, q: string, t: TFunction): boolean => {
  const needle = q.trim().toLowerCase()
  if (!needle) return true
  const digits = needle.replace(/\D/g, '')
  return (digits.length > 0 && entry.phoneNumber.replace(/\D/g, '').includes(digits)) || entry.reason.toLowerCase().includes(needle) || reasonLabel(entry.reason, t).toLowerCase().includes(needle)
}

function AddDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { t } = useTranslation('config')
  const { t: tc } = useTranslation()
  const add = useAddDnc()
  const mapErrors = useFieldErrors()
  const toastError = useToastError()
  const [phone, setPhone] = useState('')
  const [reason, setReason] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})

  const submit = (event?: FormEvent) => {
    event?.preventDefault()
    if (!phone.trim()) {
      setErrors({ phoneNumber: t('server.required') })
      return
    }
    setErrors({})
    add.mutate(
      { phoneNumber: phone.trim(), reason: reason.trim() },
      {
        onSuccess: () => {
          toast.success(t('dnc.added'))
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
      title={t('dnc.add')}
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            {tc('actions.cancel')}
          </Button>
          <Button variant="dial" loading={add.isPending} onClick={() => submit()}>
            {tc('actions.add')}
          </Button>
        </>
      }
    >
      <form onSubmit={submit} className="grid gap-4">
        <Field label={t('dnc.phone')} hint={t('dnc.phoneHint')} required error={errors.phoneNumber} htmlFor="dnc-phone">
          <Input id="dnc-phone" mono inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} invalid={Boolean(errors.phoneNumber)} autoFocus placeholder="+995 500 0X XX XX" />
        </Field>
        <Field label={t('dnc.reason')} htmlFor="dnc-reason">
          <Input id="dnc-reason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder={t('dnc.reasonPlaceholder')} maxLength={160} />
        </Field>
        <button type="submit" hidden />
      </form>
    </Dialog>
  )
}

function ImportDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { t } = useTranslation('config')
  const { t: tc } = useTranslation()
  const importList = useImportDnc()
  const toastError = useToastError()
  const inputRef = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<{ name: string; text: string; lines: number } | null>(null)
  const [error, setError] = useState('')
  const [dragging, setDragging] = useState(false)

  const read = (picked: File | undefined) => {
    if (!picked) return
    setError('')
    if (!/\.(csv|txt)$/i.test(picked.name)) {
      setFile(null)
      setError(t('dnc.wrongType'))
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      const text = typeof reader.result === 'string' ? reader.result : ''
      setFile({ name: picked.name, text, lines: text.split(/\r?\n/).filter((line) => line.trim()).length })
    }
    reader.onerror = () => {
      setFile(null)
      setError(t('dnc.readError'))
    }
    reader.readAsText(picked)
  }

  const onDrop = (event: DragEvent) => {
    event.preventDefault()
    setDragging(false)
    read(event.dataTransfer.files[0])
  }

  const submit = () => {
    if (!file) return
    importList.mutate(
      { text: file.text, filename: file.name },
      {
        onSuccess: (result) => {
          toast.success(t('dnc.importDone', { imported: result.imported }), {
            description: t('dnc.importSummary', { duplicates: result.duplicates, invalid: result.invalid }),
          })
          onOpenChange(false)
        },
        onError: toastError,
      },
    )
  }

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={t('dnc.importTitle')}
      description={t('dnc.importDescription')}
      footer={
        <>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            {tc('actions.cancel')}
          </Button>
          <Button variant="dial" disabled={!file} loading={importList.isPending} onClick={submit}>
            {t('dnc.importBtn')}
          </Button>
        </>
      }
    >
      <div className="grid gap-3">
        <div
          onDragOver={(e) => {
            e.preventDefault()
            setDragging(true)
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          className={cn(
            'flex flex-col items-center gap-2 rounded-card border border-dashed px-4 py-8 text-center transition-colors',
            dragging ? 'border-carbon bg-lime/25 dark:border-lime' : 'border-hairline-strong bg-sunken',
          )}
        >
          {file ? <FileText size={28} strokeWidth={1.5} className="text-ink" aria-hidden /> : <Upload size={28} strokeWidth={1.5} className="text-muted" aria-hidden />}
          {file ? (
            <p className="break-all font-medium text-ink">{t('dnc.chosen', { name: file.name, lines: file.lines })}</p>
          ) : (
            <p className="font-medium text-ink">{dragging ? t('dnc.dropActive') : t('dnc.drop')}</p>
          )}
          <p className="text-xs text-muted">{t('dnc.fileTypes')}</p>
          <Button size="sm" variant="outline" onClick={() => inputRef.current?.click()}>
            {file ? t('dnc.replace') : t('dnc.browse')}
          </Button>
          <input
            ref={inputRef}
            type="file"
            accept=".csv,.txt,text/csv,text/plain"
            className="sr-only"
            tabIndex={-1}
            aria-label={t('dnc.browse')}
            onChange={(e) => {
              read(e.target.files?.[0])
              e.target.value = ''
            }}
          />
        </div>
        {error && (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        )}
        <a href={`${import.meta.env.BASE_URL}samples/dareke-dnc-sample.csv`} download className="w-fit text-sm font-medium text-ink underline underline-offset-4">
          {t('dnc.sample')}
        </a>
      </div>
    </Dialog>
  )
}

export default function DncPage() {
  const { t } = useTranslation('config')
  const { t: tc } = useTranslation()
  const l = useLocalized()
  const canEdit = useCanEdit()
  const query = useDnc()
  const remove = useRemoveDnc()
  const toastError = useToastError()
  const [q, setQ] = useState('')
  const [addOpen, setAddOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [removing, setRemoving] = useState<DncEntryView | null>(null)

  const all = query.data ?? []
  const rows = all.filter((entry) => matches(entry, q, t))

  const columns: Column<DncEntryView>[] = [
    { key: 'phone', header: t('dnc.cols.phone'), sortValue: (e) => e.phoneNumber, cell: (e) => <span className="font-mono tabular text-ink">{formatPhone(e.phoneNumber)}</span> },
    { key: 'reason', header: t('dnc.cols.reason'), sortValue: (e) => e.reason, cell: (e) => <span className="line-clamp-2 text-ink">{reasonLabel(e.reason, t)}</span> },
    { key: 'source', header: t('dnc.cols.source'), sortValue: (e) => e.source, cell: (e) => <Badge tone={SOURCE_TONE[e.source]}>{tc(`dncSource.${e.source}`)}</Badge> },
    { key: 'by', header: t('dnc.cols.addedBy'), hideOnMobile: true, cell: (e) => <span className="text-muted">{e.addedByName ? l(e.addedByName) : t('dnc.systemUser')}</span> },
    { key: 'date', header: t('dnc.cols.date'), hideOnMobile: true, sortValue: (e) => e.createdAt, cell: (e) => <span className="font-mono tabular text-muted">{formatDate(e.createdAt)}</span> },
  ]
  if (canEdit)
    columns.push({
      key: 'actions',
      header: '',
      align: 'right',
      width: '56px',
      cell: (e) => <IconButton label={tc('actions.remove')} icon={<Trash2 size={16} strokeWidth={1.75} />} size="sm" onClick={() => setRemoving(e)} />,
    })

  return (
    <section>
      <PageHeader
        eyebrow={t('eyebrow')}
        title={t('pages.DncPage')}
        description={t('dnc.description')}
        actions={
          canEdit && (
            <>
              <Button variant="outline" icon={<Upload size={18} strokeWidth={1.75} />} onClick={() => setImportOpen(true)}>
                {t('dnc.import')}
              </Button>
              <Button variant="dial" icon={<Plus size={18} strokeWidth={1.75} />} onClick={() => setAddOpen(true)}>
                {t('dnc.add')}
              </Button>
            </>
          )
        }
      />
      {!canEdit && <ReadOnlyNote />}
      <Toolbar end={<span className="text-xs text-muted">{q.trim() ? t('dnc.shown', { shown: rows.length, total: all.length }) : t('dnc.count', { count: all.length })}</span>}>
        <SearchInput value={q} onChange={setQ} placeholder={t('dnc.search')} />
      </Toolbar>
      <div className="mt-3">
        {query.isError ? (
          <LoadError error={query.error} onRetry={() => void query.refetch()} />
        ) : (
          <DataTable
            rows={rows}
            columns={columns}
            rowKey={(e) => e.id}
            loading={query.isLoading}
            pageSize={15}
            initialSort={{ key: 'date', dir: 'desc' }}
            empty={
              <div className="py-10 text-center">
                <p className="font-medium text-ink">{q.trim() ? t('dnc.noMatch') : t('dnc.empty')}</p>
                <p className="text-sm text-muted">{q.trim() ? t('dnc.noMatchHint') : t('dnc.emptyHint')}</p>
              </div>
            }
          />
        )}
      </div>
      <p className="mt-2 text-xs text-muted">{tc('demoDataNote')}</p>

      {addOpen && <AddDialog open={addOpen} onOpenChange={setAddOpen} />}
      {importOpen && <ImportDialog open={importOpen} onOpenChange={setImportOpen} />}

      <ConfirmDialog
        open={Boolean(removing)}
        onOpenChange={(open) => !open && setRemoving(null)}
        title={t('dnc.removeTitle')}
        description={removing ? t('dnc.removeBody', { phone: formatPhone(removing.phoneNumber) }) : undefined}
        confirmLabel={tc('actions.remove')}
        tone="danger"
        loading={remove.isPending}
        onConfirm={() =>
          removing &&
          remove.mutate(removing.id, {
            onSuccess: () => {
              toast.success(t('dnc.removed'))
              setRemoving(null)
            },
            onError: (error) => {
              toastError(error)
              setRemoving(null)
            },
          })
        }
      />
    </section>
  )
}
