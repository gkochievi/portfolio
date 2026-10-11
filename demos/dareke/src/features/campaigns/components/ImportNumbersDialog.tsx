/** Upload a CSV/TXT lead list: parsed in the browser, previewed, then imported. */
import { Download, FileText, UploadCloud, X } from 'lucide-react'
import { useEffect, useRef, useState, type DragEvent } from 'react'
import { useTranslation } from 'react-i18next'

import { Alert, Button, Dialog, IconButton, Switch, Table, TBody, TD, TH, THead, TR } from '@/components/ui'
import { cn } from '@/lib/cn'
import { parseCsv, readFileText } from '@/lib/csv'
import { toast } from '@/lib/toast'

import { useImportNumbers } from '../api'
import { useApiErrorText } from './shared'

const PHONE_KEYS = ['phone', 'phonenumber', 'number']
const NAME_KEYS = ['name', 'customername']
const keyOf = (header: string) => header.toLowerCase().replace(/[^a-z]/g, '')
const looksLikePhone = (value: string) => /^[+\d][\d\s().-]{6,}$/.test(value.trim())

interface Parsed {
  fileName: string
  headers: string[]
  rows: Record<string, string>[]
  phoneKey: string | null
  nameKey: string | null
}

/** Header row (lower-cased) -> records; a header-less list becomes phone[,name]. */
function toRows(text: string, fileName: string): Parsed {
  const grid = parseCsv(text.replace(/^﻿/, ''))
  const first = grid[0] ?? []
  const headerless = first.length > 0 && looksLikePhone(first[0] ?? '') && !first.some((h) => PHONE_KEYS.includes(keyOf(h)))
  const headers = headerless ? ['phone', 'name'].slice(0, Math.max(1, Math.min(2, first.length))) : first.map((h) => h.trim().toLowerCase())
  const body = headerless ? grid : grid.slice(1)
  const rows = body.map((cells) => Object.fromEntries(headers.map((h, i) => [h, (cells[i] ?? '').trim()])))
  return {
    fileName,
    headers,
    rows,
    phoneKey: headers.find((h) => PHONE_KEYS.includes(keyOf(h))) ?? null,
    nameKey: headers.find((h) => NAME_KEYS.includes(keyOf(h))) ?? null,
  }
}

export function ImportNumbersDialog({
  open,
  onOpenChange,
  campaignId,
  campaignName,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  campaignId: string
  campaignName: string
}) {
  const { t } = useTranslation('campaigns')
  const { t: tc } = useTranslation()
  const errText = useApiErrorText()
  const input = useRef<HTMLInputElement>(null)
  const [parsed, setParsed] = useState<Parsed | null>(null)
  const [problem, setProblem] = useState<string | null>(null)
  const [dragging, setDragging] = useState(false)
  const [allowDuplicates, setAllowDuplicates] = useState(false)
  const importer = useImportNumbers(campaignId)
  const sampleUrl = `${import.meta.env.BASE_URL}samples/dareke-leads-sample.csv`

  useEffect(() => {
    if (!open) {
      setParsed(null)
      setProblem(null)
      setAllowDuplicates(false)
      setDragging(false)
    }
  }, [open])

  const accept = async (file: File | undefined) => {
    if (!file) return
    setProblem(null)
    setParsed(null)
    const lower = file.name.toLowerCase()
    if (lower.endsWith('.xlsx') || lower.endsWith('.xls')) return setProblem(t('upload.xlsx'))
    if (!lower.endsWith('.csv') && !lower.endsWith('.txt')) return setProblem(t('upload.badType'))
    if (file.size > 5 * 1024 * 1024) return setProblem(t('upload.tooBig'))
    try {
      const result = toRows(await readFileText(file), file.name)
      if (result.rows.length === 0) return setProblem(t('upload.empty'))
      if (!result.phoneKey) return setProblem(t('upload.noPhone'))
      if (result.rows.length > 5000) return setProblem(t('errors.tooManyRows'))
      setParsed(result)
    } catch {
      setProblem(t('upload.readFailed'))
    }
  }

  const onDrop = (event: DragEvent) => {
    event.preventDefault()
    setDragging(false)
    void accept(event.dataTransfer.files[0])
  }

  const submit = () => {
    if (!parsed) return
    importer.mutate(
      { rows: parsed.rows, allowDuplicates },
      {
        onSuccess: (r) => {
          toast.success(t('upload.done', { count: r.inserted + r.duplicates }), {
            description: t('upload.summary', { inserted: r.inserted, skipped: r.skipped, duplicates: r.duplicates, dnc: r.dncMarked, invalid: r.invalid }),
          })
          onOpenChange(false)
        },
        onError: (error) => toast.error(t('upload.failed'), { description: errText(error) }),
      },
    )
  }

  const preview = parsed?.rows.slice(0, 5) ?? []
  const previewCols = parsed ? parsed.headers.slice(0, 4) : []

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      size="lg"
      title={t('upload.title')}
      description={t('upload.subtitle', { name: campaignName })}
      footer={
        <div className="flex w-full flex-wrap items-center justify-between gap-2">
          <a href={sampleUrl} download className="inline-flex items-center gap-1.5 text-sm text-ink underline underline-offset-4 hover:text-muted">
            <Download size={16} strokeWidth={1.75} />
            {t('upload.sample')}
          </a>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => onOpenChange(false)}>
              {tc('actions.cancel')}
            </Button>
            <Button variant="dial" disabled={!parsed} loading={importer.isPending} onClick={submit}>
              {parsed ? t('upload.importN', { count: parsed.rows.length }) : t('upload.import')}
            </Button>
          </div>
        </div>
      }
    >
      <div className="space-y-4">
        {!parsed ? (
          <div
            role="button"
            tabIndex={0}
            onClick={() => input.current?.click()}
            onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && input.current?.click()}
            onDragOver={(e) => {
              e.preventDefault()
              setDragging(true)
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            className={cn(
              'flex cursor-pointer flex-col items-center justify-center gap-2 rounded-card border-2 border-dashed border-hairline-strong bg-sunken px-4 py-10 text-center transition-colors',
              dragging && 'border-ink bg-lime/20',
            )}
          >
            <UploadCloud size={28} strokeWidth={1.5} className="text-muted" />
            <p className="font-medium text-ink">{t('upload.drop')}</p>
            <p className="text-xs text-muted">{t('upload.formats')}</p>
          </div>
        ) : (
          <div className="flex items-center gap-3 rounded-card border border-hairline px-3 py-2">
            <FileText size={18} strokeWidth={1.75} className="shrink-0 text-muted" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-ink">{parsed.fileName}</p>
              <p className="text-xs text-muted">{t('upload.parsed', { count: parsed.rows.length, columns: parsed.headers.length })}</p>
            </div>
            <IconButton label={t('upload.change')} icon={<X size={18} strokeWidth={1.75} />} onClick={() => setParsed(null)} />
          </div>
        )}
        <input
          ref={input}
          type="file"
          accept=".csv,.txt,text/csv,text/plain"
          className="hidden"
          onChange={(e) => {
            void accept(e.target.files?.[0])
            e.target.value = ''
          }}
        />
        {problem && <Alert tone="danger">{problem}</Alert>}
        {parsed && (
          <>
            <div className="overflow-x-auto rounded-card border border-hairline">
              <Table>
                <THead>
                  <TR>
                    {previewCols.map((h) => (
                      <TH key={h}>
                        {h}
                        {h === parsed.phoneKey && <span className="ml-1 text-success">· {t('upload.phoneCol')}</span>}
                        {h === parsed.nameKey && <span className="ml-1 text-info">· {t('upload.nameCol')}</span>}
                      </TH>
                    ))}
                  </TR>
                </THead>
                <TBody>
                  {preview.map((row, i) => (
                    <TR key={i}>
                      {previewCols.map((h) => (
                        <TD key={h} className={cn('max-w-[180px] truncate', h === parsed.phoneKey && 'font-mono')}>
                          {row[h]}
                        </TD>
                      ))}
                    </TR>
                  ))}
                </TBody>
              </Table>
            </div>
            <p className="text-xs text-muted">{t('upload.previewNote', { shown: preview.length, total: parsed.rows.length })}</p>
          </>
        )}
        <Switch checked={allowDuplicates} onCheckedChange={setAllowDuplicates} label={t('upload.allowDuplicates')} description={t('upload.allowDuplicatesHint')} />
        <p className="text-xs text-muted">{t('upload.rules')}</p>
      </div>
    </Dialog>
  )
}
