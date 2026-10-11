import { CheckCircle2, ClipboardPaste, Download, FileSpreadsheet, FileUp, Files, Trash2, TriangleAlert } from 'lucide-react'
import { useId, useRef, useState, type DragEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'

import { errorMessage, fieldError } from '@/api/client'
import {
  Badge,
  Button,
  Callout,
  Field,
  IconButton,
  Input,
  Panel,
  ProgressBar,
  ReadOnlyNote,
  SegmentedControl,
  Select,
  Switch,
  Textarea,
  toast,
} from '@/components/ui'
import { useFormat } from '@/lib/format'
import { cn } from '@/lib/cn'
import { useCanEdit } from '@/lib/session'
import type { KbDocType } from '@/types'
import { useImportCsv, useImportFiles, useImportText, useKbTags } from '../api'
import { MetadataEditor, TagsInput, rowsToMeta, type MetaRow } from '../components/fields'
import { useDocTypeOptions } from '../components/dialogs'
import { buildTemplate, downloadText, parseQaCsv, type QaParse } from '../lib/csv'
import { KB_FILE_EXTENSIONS, KB_TEXT_EXTENSIONS, type KbImportCommon } from '../types'

type Mode = 'files' | 'text' | 'csv'
const MAX_FILES = 20
const MAX_BYTES = 25 * 1024 * 1024
const MAX_TEXT_CHARS = 400_000

const extOf = (name: string): string => (name.includes('.') ? (name.split('.').pop() ?? '').toLowerCase() : '')

interface Outcome {
  imported: number
  failed: { name: string; error: string }[]
}

/** Import: files, pasted text or a Q/A CSV. OWNED BY: knowledge-base. */
export default function KbImportPage() {
  const { t } = useTranslation('kb')
  const fmt = useFormat()
  const canEdit = useCanEdit()
  const tags = useKbTags()
  const typeOptions = useDocTypeOptions()
  const importFiles = useImportFiles()
  const importText = useImportText()
  const importCsv = useImportCsv()

  const [mode, setMode] = useState<Mode>('files')
  const [docType, setDocType] = useState<KbDocType>('faq')
  const [title, setTitle] = useState('')
  const [tagList, setTagList] = useState<string[]>([])
  const [meta, setMeta] = useState<MetaRow[]>([])
  const [restructure, setRestructure] = useState(false)

  const [files, setFiles] = useState<File[]>([])
  const [text, setText] = useState('')
  const [csvName, setCsvName] = useState('')
  const [csv, setCsv] = useState<QaParse | null>(null)

  const [errors, setErrors] = useState<Record<string, string>>({})
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null)
  const [outcome, setOutcome] = useState<Outcome | null>(null)
  const running = progress !== null || importText.isPending || importCsv.isPending

  const fileInput = useRef<HTMLInputElement>(null)
  const csvInput = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)
  const dropId = useId()

  const accept = KB_FILE_EXTENSIONS.map((e) => `.${e}`).join(',')

  const templates = (
    <Panel title={t('import.templateTitle')} description={t('import.templateBody')} icon={<FileSpreadsheet />}>
      <div className="flex flex-wrap gap-2">
        {(['ka', 'en'] as const).map((lang) => (
          <Button
            key={lang}
            variant="secondary"
            icon={<Download />}
            onClick={() => {
              const file = buildTemplate(lang)
              downloadText(file.filename, file.content)
              toast.success(t('import.templateSaved', { name: file.filename }))
            }}
          >
            {t(`import.template.${lang}`)}
          </Button>
        ))}
      </div>
    </Panel>
  )

  if (!canEdit) {
    return (
      <div className="flex flex-col gap-6">
        <ReadOnlyNote>{t('import.readOnly')}</ReadOnlyNote>
        {templates}
      </div>
    )
  }

  /* ------------------------------------------------------------ files */

  const addFiles = (incoming: FileList | File[]) => {
    const list = [...incoming]
    const next = [...files]
    const problems: string[] = []
    for (const file of list) {
      if (!(KB_FILE_EXTENSIONS as readonly string[]).includes(extOf(file.name))) problems.push(t('validation.unsupported', { name: file.name }))
      else if (file.size > MAX_BYTES) problems.push(t('validation.tooLarge', { name: file.name }))
      else if (next.some((f) => f.name === file.name && f.size === file.size)) continue
      else if (next.length >= MAX_FILES) problems.push(t('validation.tooMany', { count: MAX_FILES }))
      else next.push(file)
    }
    setFiles(next)
    setOutcome(null)
    setErrors(problems.length ? { files: problems.slice(0, 3).join(' ') } : {})
  }

  const onDrop = (e: DragEvent) => {
    e.preventDefault()
    setDragging(false)
    if (e.dataTransfer.files.length) addFiles(e.dataTransfer.files)
  }

  const readCsvFile = async (file: File) => {
    if (extOf(file.name) !== 'csv') {
      setErrors({ csv: t('validation.csvOnly') })
      return
    }
    const parsed = parseQaCsv(await file.text())
    setCsvName(file.name)
    setCsv(parsed)
    setOutcome(null)
    setErrors({})
  }

  const common = (): KbImportCommon | null => {
    const parsed = rowsToMeta(meta)
    if (parsed.error) {
      setErrors((e) => ({ ...e, metadata: t(`validation.${parsed.error}`) }))
      return null
    }
    return { doc_type: docType, title: title.trim() || undefined, tags: tagList, metadata: parsed.value, restructure }
  }

  const finish = (result: Outcome) => {
    setOutcome(result)
    if (result.failed.length === 0) toast.success(t('import.imported', { count: result.imported }))
    else toast.warning(t('import.partial', { ok: result.imported, failed: result.failed.length }))
  }

  const submit = async () => {
    setOutcome(null)
    setErrors({})

    if (mode === 'files') {
      if (files.length === 0) return setErrors({ files: t('validation.filesRequired') })
      const base = common()
      if (!base) return
      setProgress({ done: 0, total: files.length })
      const failed: Outcome['failed'] = []
      let ok = 0
      for (const [index, file] of files.entries()) {
        try {
          const raw = (KB_TEXT_EXTENSIONS as readonly string[]).includes(extOf(file.name)) ? await file.text() : undefined
          const result = await importFiles.mutateAsync({
            ...base,
            title: files.length === 1 ? base.title : undefined,
            files: [{ name: file.name, size: file.size, ...(raw !== undefined ? { text: raw.slice(0, MAX_TEXT_CHARS) } : {}) }],
          })
          failed.push(...result.failed)
          ok += result.documents.length - result.failed.length
        } catch (error) {
          failed.push({ name: file.name, error: errorMessage(error) })
        }
        setProgress({ done: index + 1, total: files.length })
      }
      setProgress(null)
      setFiles([])
      finish({ imported: ok, failed })
      return
    }

    if (mode === 'text') {
      const next: Record<string, string> = {}
      if (!title.trim()) next.title = t('validation.titleRequired')
      if (text.trim().length < 20) next.text = text.trim() ? t('validation.textShort') : t('validation.textRequired')
      setErrors(next)
      if (Object.keys(next).length) return
      const base = common()
      if (!base) return
      try {
        const result = await importText.mutateAsync({ ...base, text })
        setText('')
        setTitle('')
        finish({ imported: result.documents.length, failed: result.failed })
      } catch (error) {
        setErrors({ title: fieldError(error, 'title') ?? '', text: fieldError(error, 'text') ?? '', form: errorMessage(error) })
      }
      return
    }

    if (!csv || csv.error || csv.rows.length === 0) return setErrors({ csv: t('validation.csvRequired') })
    const base = common()
    if (!base) return
    try {
      const result = await importCsv.mutateAsync({ ...base, filename: csvName, rows: csv.rows })
      setCsv(null)
      setCsvName('')
      finish({ imported: result.documents.length, failed: result.failed })
    } catch (error) {
      setErrors({ csv: fieldError(error, 'rows') ?? errorMessage(error) })
    }
  }

  const fileTotal = files.reduce((sum, f) => sum + f.size, 0)

  return (
    <div className="flex flex-col gap-6">
      <SegmentedControl
        value={mode}
        onValueChange={(v) => {
          setMode(v as Mode)
          setErrors({})
          setDocType(v === 'csv' ? 'faq' : docType)
        }}
        options={[
          { value: 'files', label: t('import.modes.files'), icon: <Files /> },
          { value: 'text', label: t('import.modes.text'), icon: <ClipboardPaste /> },
          { value: 'csv', label: t('import.modes.csv'), icon: <FileSpreadsheet /> },
        ]}
      />

      <div className="grid gap-6 lg:grid-cols-[3fr_2fr]">
        <div className="flex flex-col gap-6">
          {mode === 'files' ? (
            <Panel title={t('import.filesTitle')} description={t('import.filesBody', { types: KB_FILE_EXTENSIONS.join(', ') })} icon={<FileUp />}>
              <div className="flex flex-col gap-4">
                <label
                  htmlFor={dropId}
                  onDragOver={(e) => {
                    e.preventDefault()
                    setDragging(true)
                  }}
                  onDragLeave={() => setDragging(false)}
                  onDrop={onDrop}
                  className={cn(
                    'flex cursor-pointer flex-col items-center gap-2 rounded-card border border-dashed border-line-strong px-4 py-8 text-center transition-colors hover:bg-sunken',
                    dragging && 'border-primary bg-primary/8',
                  )}
                >
                  <FileUp className="size-6 text-primary" strokeWidth={1.5} aria-hidden />
                  <span className="text-sm font-medium">{t('import.drop')}</span>
                  <span className="text-xs text-muted">{t('import.dropHint', { max: MAX_FILES, size: fmt.bytes(MAX_BYTES) })}</span>
                  <input
                    id={dropId}
                    ref={fileInput}
                    type="file"
                    multiple
                    accept={accept}
                    className="sr-only"
                    onChange={(e) => {
                      if (e.target.files) addFiles(e.target.files)
                      e.target.value = ''
                    }}
                  />
                </label>
                {errors.files ? <p role="alert" className="text-xs text-danger">{errors.files}</p> : null}
                {files.length > 0 ? (
                  <ul className="divide-y divide-line rounded-card border border-line" aria-label={t('import.queue')}>
                    {files.map((file) => (
                      <li key={`${file.name}-${file.size}`} className="flex items-center gap-3 px-3 py-2 text-sm">
                        <span className="min-w-0 flex-1 truncate">{file.name}</span>
                        <Badge size="sm" shape="tag">
                          {extOf(file.name)}
                        </Badge>
                        <span className="tabular w-16 text-right text-xs text-muted">{fmt.bytes(file.size)}</span>
                        <IconButton label={t('import.removeFile', { name: file.name })} icon={<Trash2 />} size="sm" disabled={running} onClick={() => setFiles((f) => f.filter((x) => x !== file))} />
                      </li>
                    ))}
                    <li className="flex items-center justify-between bg-sunken px-3 py-2 text-xs text-muted">
                      <span>{t('import.fileCount', { count: files.length })}</span>
                      <span className="tabular">{fmt.bytes(fileTotal)}</span>
                    </li>
                  </ul>
                ) : null}
                <p className="text-xs text-muted">{t('import.binaryNote')}</p>
              </div>
            </Panel>
          ) : null}

          {mode === 'text' ? (
            <Panel title={t('import.textTitle')} description={t('import.textBody')} icon={<ClipboardPaste />}>
              <Field label={t('import.textLabel')} error={errors.text || undefined} hint={t('import.textCount', { chars: fmt.number(text.length) })}>
                <Textarea rows={12} value={text} disabled={running} onChange={(e) => setText(e.target.value)} placeholder={t('import.textPlaceholder')} className="font-sans text-[14px] leading-relaxed" />
              </Field>
            </Panel>
          ) : null}

          {mode === 'csv' ? (
            <Panel title={t('import.csvTitle')} description={t('import.csvBody')} icon={<FileSpreadsheet />}>
              <div className="flex flex-col gap-4">
                <div className="flex flex-wrap items-center gap-3">
                  <Button variant="secondary" icon={<FileUp />} onClick={() => csvInput.current?.click()} disabled={running}>
                    {csv ? t('import.csvReplace') : t('import.csvChoose')}
                  </Button>
                  {csvName ? <span className="truncate text-sm text-muted">{csvName}</span> : null}
                  <input
                    ref={csvInput}
                    type="file"
                    accept=".csv,text/csv"
                    className="sr-only"
                    aria-label={t('import.csvChoose')}
                    onChange={(e) => {
                      const file = e.target.files?.[0]
                      if (file) void readCsvFile(file)
                      e.target.value = ''
                    }}
                  />
                </div>
                {errors.csv ? <p role="alert" className="text-xs text-danger">{errors.csv}</p> : null}
                {csv?.error === 'no_header' ? <Callout tone="danger">{t('import.csvNoHeader')}</Callout> : null}
                {csv?.error === 'empty' ? <Callout tone="warning">{t('import.csvEmpty')}</Callout> : null}
                {csv && !csv.error ? (
                  <div className="flex flex-col gap-2">
                    <p className="text-sm">
                      <span className="font-medium">{t('import.csvRows', { count: csv.rows.length })}</span>
                      {csv.skipped > 0 ? <span className="text-muted"> · {t('import.csvSkipped', { count: csv.skipped })}</span> : null}
                    </p>
                    <div className="overflow-x-auto rounded-card border border-line">
                      <table className="w-full min-w-[32rem] text-left text-sm">
                        <caption className="sr-only">{t('import.csvPreview')}</caption>
                        <thead className="bg-sunken text-xs text-muted">
                          <tr>
                            <th scope="col" className="w-10 px-3 py-2 font-medium">#</th>
                            <th scope="col" className="px-3 py-2 font-medium">{t('import.question')}</th>
                            <th scope="col" className="px-3 py-2 font-medium">{t('import.answer')}</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-line">
                          {csv.rows.slice(0, 5).map((row, i) => (
                            <tr key={i} className="align-top">
                              <td className="tabular px-3 py-2 text-muted">{i + 1}</td>
                              <td className="px-3 py-2">{row.question}</td>
                              <td className="px-3 py-2 text-muted">{row.answer}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    {csv.rows.length > 5 ? <p className="text-xs text-muted">{t('import.csvMore', { count: csv.rows.length - 5 })}</p> : null}
                  </div>
                ) : null}
              </div>
            </Panel>
          ) : null}

          <Panel title={t('import.detailsTitle')} description={t('import.detailsBody')}>
            <div className="flex flex-col gap-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label={t('fields.docType')}>
                  <Select value={docType} onValueChange={(v) => setDocType(v as KbDocType)} options={typeOptions} disabled={running} />
                </Field>
                <Field
                  label={t('fields.title')}
                  optional={mode !== 'text'}
                  hint={mode === 'files' ? t('import.titleFilesHint') : mode === 'csv' ? t('import.titleCsvHint') : undefined}
                  error={errors.title || undefined}
                >
                  <Input value={title} disabled={running} maxLength={200} onChange={(e) => setTitle(e.target.value)} />
                </Field>
              </div>
              <Field label={t('fields.tags')} optional>
                <TagsInput value={tagList} onChange={setTagList} suggestions={tags.data} disabled={running} />
              </Field>
              <Field label={t('fields.metadata')} optional hint={t('fields.metadataHint')} error={errors.metadata}>
                <MetadataEditor rows={meta} onChange={setMeta} disabled={running} />
              </Field>
              <Switch checked={restructure} onCheckedChange={setRestructure} disabled={running} label={t('import.restructure')} description={t('import.restructureHint')} />
            </div>
          </Panel>

          {errors.form ? <Callout tone="danger">{errors.form}</Callout> : null}

          <div className="flex flex-col gap-3">
            {progress ? <ProgressBar value={progress.done} max={progress.total} label={t('import.progress', { done: progress.done, total: progress.total })} showValue={false} /> : null}
            <div>
              <Button variant="primary" size="lg" icon={<FileUp />} loading={running} onClick={() => void submit()}>
                {mode === 'files' && files.length > 1 ? t('import.submitMany', { count: files.length }) : t('import.submit')}
              </Button>
            </div>
          </div>

          {outcome ? (
            <div className="flex flex-col gap-3" aria-live="polite">
              {outcome.imported > 0 ? (
                <Callout
                  tone="success"
                  icon={<CheckCircle2 />}
                  title={t('import.imported', { count: outcome.imported })}
                  action={
                    <Button asChild size="sm" variant="secondary">
                      <Link to="/workspace/kb/documents">{t('import.viewDocuments')}</Link>
                    </Button>
                  }
                >
                  {t('import.processingNote')}
                </Callout>
              ) : null}
              {outcome.failed.length > 0 ? (
                <Callout tone="danger" icon={<TriangleAlert />} title={t('import.failedTitle', { count: outcome.failed.length })}>
                  <ul className="mt-1 list-disc pl-5">
                    {outcome.failed.map((f) => (
                      <li key={f.name}>
                        <span className="font-medium">{f.name}</span>: {f.error}
                      </li>
                    ))}
                  </ul>
                </Callout>
              ) : null}
            </div>
          ) : null}
        </div>

        <div className="flex flex-col gap-6">
          {templates}
          <Callout tone="info" title={t('import.visibilityTitle')}>
            {t('import.visibilityBody')}
          </Callout>
        </div>
      </div>
    </div>
  )
}
