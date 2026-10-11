import { ChevronRight, Download, ScrollText } from 'lucide-react'
import { Fragment, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Badge, Banner, Button, Card, Checkbox, EmptyState, Field, Input, JsonView, Mono, NativeSelect, PageHeader, Skeleton, toast } from '@/components/ui'
import { LogLevelChip } from '@/components/status'
import { toCsv, downloadText } from '@/lib/csv'
import { cn } from '@/lib/cn'

import { errorMessage, fetchAllSystemLogs, fieldErrorsOf, useLogRetention, useSaveLogRetention, useSystemLogs } from '../api'
import { JsonBlock, PageNav, useUrlFilters } from '../components/FilterFields'
import type { SystemLogRow } from '../lib/types'

const KEYS = ['level', 'source', 'partnerId', 'requestId', 'since', 'until', 'q'] as const
const LEVELS = ['debug', 'info', 'warn', 'error'] as const

const tbilisi = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Asia/Tbilisi',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hour12: false,
})

/** DD.MM.YYYY HH:mm:ss in the Tbilisi day (+04). */
function tbilisiTime(iso: string): string {
  const p = Object.fromEntries(tbilisi.formatToParts(new Date(iso)).map((x) => [x.type, x.value]))
  return `${p.day}.${p.month}.${p.year} ${p.hour === '24' ? '00' : p.hour}:${p.minute}:${p.second}`
}

export default function SystemLogsPage() {
  const { t } = useTranslation('ops')
  const { applied, page, apply, setPage } = useUrlFilters(KEYS)
  const [draft, setDraft] = useState(applied)
  const [open, setOpen] = useState<Set<string>>(new Set())
  const [selected, setSelected] = useState<Map<string, SystemLogRow>>(new Map())
  const [exporting, setExporting] = useState(false)
  const appliedKey = KEYS.map((k) => applied[k]).join('|')
  useEffect(() => setDraft(applied), [appliedKey]) // eslint-disable-line react-hooks/exhaustive-deps

  const query = useSystemLogs({ ...applied, page })
  const data = query.data
  const hasFilter = KEYS.some((k) => applied[k])
  const dateInvalid = !!draft.since && !!draft.until && draft.since > draft.until
  const set = (k: (typeof KEYS)[number]) => (v: string) => setDraft((d) => ({ ...d, [k]: v }))
  const partnerOptions = useMemo(() => (data?.facets.partners ?? []).map((p) => ({ value: p.id, label: p.name })), [data])
  const sourceListId = 'log-sources'

  const rows = data?.items ?? []
  const pageSelected = rows.filter((r) => selected.has(r.id)).length
  const allOnPage = rows.length > 0 && pageSelected === rows.length

  const toggleOpen = (id: string) =>
    setOpen((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  const toggleRow = (row: SystemLogRow, on: boolean) =>
    setSelected((prev) => {
      const next = new Map(prev)
      if (on) next.set(row.id, row)
      else next.delete(row.id)
      return next
    })
  const toggleAllOnPage = (on: boolean) =>
    setSelected((prev) => {
      const next = new Map(prev)
      for (const r of rows) {
        if (on) next.set(r.id, r)
        else next.delete(r.id)
      }
      return next
    })

  const csv = (list: SystemLogRow[]) =>
    toCsv(list, [
      { key: 'createdAt', header: t('logs.csv.time') },
      { key: 'level', header: t('logs.csv.level') },
      { key: 'source', header: t('logs.csv.source') },
      { key: 'partnerName', header: t('logs.csv.partner') },
      { key: 'requestId', header: t('logs.csv.requestId') },
      { key: 'message', header: t('logs.csv.message') },
      { key: 'context', header: t('logs.csv.context') },
      { key: 'payload', header: t('logs.csv.payload') },
    ])

  const stamp = new Date().toISOString().slice(0, 10)

  const exportFiltered = async () => {
    if (!hasFilter) {
      toast.error(t('logs.exportNeedsFilter'))
      return
    }
    setExporting(true)
    try {
      const all = await fetchAllSystemLogs(applied)
      if (all.items.length === 0) {
        toast.info(t('logs.exportEmpty'))
        return
      }
      downloadText(`system-log-${stamp}.csv`, csv(all.items))
      toast.success(t('logs.exported', { count: all.items.length }))
    } catch (error) {
      toast.error(errorMessage(error))
    } finally {
      setExporting(false)
    }
  }

  const exportSelected = () => {
    const list = [...selected.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    downloadText(`system-log-selected-${stamp}.csv`, csv(list))
    toast.success(t('logs.exported', { count: list.length }))
  }

  return (
    <>
      <PageHeader
        eyebrow={t('logs.eyebrow')}
        title={t('logs.title')}
        description={t('logs.description')}
        icon={<ScrollText />}
        actions={
          <>
            <Button variant="outline" size="sm" icon={<Download />} loading={exporting} onClick={exportFiltered}>
              {t('logs.exportFiltered')}
            </Button>
            <Button variant="outline" size="sm" icon={<Download />} disabled={selected.size === 0} onClick={exportSelected}>
              {t('logs.exportSelected', { count: selected.size })}
            </Button>
          </>
        }
      />

      <RetentionCard />

      <Card className="mb-4">
        <form
          className="grid gap-3 p-3 sm:grid-cols-2 lg:grid-cols-4"
          onSubmit={(e) => {
            e.preventDefault()
            if (!dateInvalid) apply(draft)
          }}
        >
          <Field label={t('logs.filters.level')} htmlFor="log-level">
            <NativeSelect id="log-level" value={draft.level} onChange={(e) => set('level')(e.target.value)} placeholder={t('common:filters.all')} options={LEVELS.map((v) => ({ value: v, label: t(`common:logLevel.${v}`) }))} />
          </Field>
          <Field label={t('logs.filters.source')} htmlFor="log-source">
            <Input id="log-source" mono list={sourceListId} value={draft.source} placeholder="partner.user_sync" onChange={(e) => set('source')(e.target.value)} />
            <datalist id={sourceListId}>
              {(data?.facets.sources ?? []).map((s) => (
                <option key={s} value={s} />
              ))}
            </datalist>
          </Field>
          <Field label={t('logs.filters.partner')} htmlFor="log-partner">
            <NativeSelect id="log-partner" value={draft.partnerId} onChange={(e) => set('partnerId')(e.target.value)} placeholder={t('common:filters.allPartners')} options={partnerOptions} />
          </Field>
          <Field label={t('logs.filters.requestId')} htmlFor="log-rid">
            <Input id="log-rid" mono value={draft.requestId} placeholder="req_…" onChange={(e) => set('requestId')(e.target.value)} />
          </Field>
          <Field label={t('common:filters.from')} htmlFor="log-since">
            <Input id="log-since" type="date" value={draft.since} onChange={(e) => set('since')(e.target.value)} />
          </Field>
          <Field label={t('common:filters.to')} htmlFor="log-until" error={dateInvalid ? t('validation.dateRange') : undefined}>
            <Input id="log-until" type="date" value={draft.until} invalid={dateInvalid} onChange={(e) => set('until')(e.target.value)} />
          </Field>
          <Field label={t('logs.filters.q')} htmlFor="log-q" className="sm:col-span-2">
            <Input id="log-q" value={draft.q} onChange={(e) => set('q')(e.target.value)} />
          </Field>
          <div className="flex gap-2 sm:col-span-2 lg:col-span-4">
            <Button type="submit" size="sm" disabled={dateInvalid}>
              {t('common:actions.apply')}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              disabled={!hasFilter && !KEYS.some((k) => draft[k])}
              onClick={() => {
                apply({})
                setDraft(Object.fromEntries(KEYS.map((k) => [k, ''])) as typeof draft)
              }}
            >
              {t('common:actions.clear')}
            </Button>
            {selected.size > 0 && (
              <button type="button" className="link ml-auto self-center text-[13px]" onClick={() => setSelected(new Map())}>
                {t('logs.clearSelection', { count: selected.size })}
              </button>
            )}
          </div>
        </form>
      </Card>

      <Card className="overflow-hidden p-0">
        {query.isError ? (
          <div className="p-4">
            <Banner tone="danger" title={t('common:states.error')} action={<Button size="sm" variant="outline" onClick={() => query.refetch()}>{t('common:actions.retry')}</Button>}>
              {query.error.message}
            </Banner>
          </div>
        ) : query.isLoading ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 6 }, (_, i) => (
              <Skeleton key={i} className="h-9 w-full" />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <EmptyState title={hasFilter ? t('common:states.noResults') : t('logs.empty')} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-left text-[13px]">
              <thead>
                <tr className="border-b border-hairline text-muted">
                  <th className="w-9 px-2 py-2">
                    <Checkbox aria-label={t('common:table.selectAll')} checked={allOnPage} indeterminate={pageSelected > 0 && !allOnPage} onChange={(e) => toggleAllOnPage(e.target.checked)} />
                  </th>
                  <th className="w-8 px-1 py-2" aria-label={t('audit.cols.expand')} />
                  <th className="px-3 py-2 font-medium">{t('logs.cols.time')}</th>
                  <th className="px-3 py-2 font-medium">{t('logs.cols.level')}</th>
                  <th className="px-3 py-2 font-medium">{t('logs.cols.source')}</th>
                  <th className="px-3 py-2 font-medium">{t('logs.cols.partner')}</th>
                  <th className="px-3 py-2 font-medium">{t('logs.cols.message')}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const isOpen = open.has(row.id)
                  return (
                    <Fragment key={row.id}>
                      <tr className={cn('border-b border-hairline align-top hover:bg-row-hover', isOpen && 'serving bg-row-hover')}>
                        <td className="px-2 py-2.5">
                          <Checkbox aria-label={t('common:table.selectRow')} checked={selected.has(row.id)} onChange={(e) => toggleRow(row, e.target.checked)} />
                        </td>
                        <td className="px-1 py-1.5">
                          <button
                            type="button"
                            onClick={() => toggleOpen(row.id)}
                            aria-expanded={isOpen}
                            aria-label={t(isOpen ? 'audit.collapse' : 'audit.expand')}
                            className="grid size-7 place-items-center rounded text-muted hover:bg-sunken hover:text-ink focus-visible:outline-2 focus-visible:outline-signal"
                          >
                            <ChevronRight className={cn('size-4 stroke-[1.75] transition-transform', isOpen && 'rotate-90')} />
                          </button>
                        </td>
                        <td className="num whitespace-nowrap px-3 py-2.5 font-mono text-[12px]">
                          {tbilisiTime(row.createdAt)} <span className="text-subtle">+04</span>
                        </td>
                        <td className="px-3 py-2.5">
                          <LogLevelChip level={row.level} />
                        </td>
                        <td className="px-3 py-2.5 font-mono text-[12px]">{row.source}</td>
                        <td className="px-3 py-2.5">{row.partnerName ?? <span className="text-subtle">—</span>}</td>
                        <td className="max-w-[420px] px-3 py-2.5">
                          <span className={cn(!isOpen && 'line-clamp-2')}>{row.message}</span>
                        </td>
                      </tr>
                      {isOpen && (
                        <tr className="border-b border-hairline bg-sunken/40">
                          <td colSpan={2} />
                          <td colSpan={5} className="px-3 py-3">
                            <div className="grid gap-3 lg:grid-cols-2">
                              <JsonBlock label={t('logs.json.context')}>
                                <JsonView value={row.context} />
                              </JsonBlock>
                              <JsonBlock label={t('logs.json.payload')}>
                                <JsonView value={row.payload} />
                              </JsonBlock>
                            </div>
                            {row.requestId && (
                              <div className="mt-2 flex flex-wrap items-center gap-2 text-[12px] text-muted">
                                {t('logs.json.requestId')}: <Mono>{row.requestId}</Mono>
                                <button type="button" className="link" onClick={() => { apply({ ...Object.fromEntries(KEYS.map((k) => [k, ''])), requestId: row.requestId ?? '' }) }}>
                                  {t('logs.filterByRequest')}
                                </button>
                              </div>
                            )}
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
        {data && data.total > 0 && <PageNav page={data.page} pageSize={data.pageSize} total={data.total} onPage={setPage} loading={query.isFetching} />}
      </Card>
    </>
  )
}

/** Retention days (1-3650) with Save. */
function RetentionCard() {
  const { t } = useTranslation('ops')
  const query = useLogRetention()
  const save = useSaveLogRetention()
  const [value, setValue] = useState('')
  const [error, setError] = useState<string | undefined>()

  useEffect(() => {
    if (query.data) setValue(String(query.data.days))
  }, [query.data])

  const dirty = query.data !== undefined && value !== String(query.data.days)

  const onSave = async () => {
    const n = Number(value)
    if (!/^\d+$/.test(value.trim()) || n < 1 || n > 3650) {
      setError(t('validation.retention'))
      return
    }
    setError(undefined)
    try {
      await save.mutateAsync(n)
      toast.success(t('logs.retentionSaved', { days: n }))
    } catch (err) {
      setError(fieldErrorsOf(err).days ?? errorMessage(err))
    }
  }

  return (
    <Card className="mb-4">
      <form
        className="flex flex-wrap items-end gap-3 p-3"
        onSubmit={(e) => {
          e.preventDefault()
          void onSave()
        }}
      >
        <Field label={t('logs.retention.label')} hint={t('logs.retention.hint')} htmlFor="log-retention" error={error}>
          <Input id="log-retention" type="number" inputMode="numeric" min={1} max={3650} className="w-32" value={value} invalid={!!error} disabled={query.isLoading} onChange={(e) => setValue(e.target.value)} suffix={t('logs.retention.days')} />
        </Field>
        <Button type="submit" size="sm" variant="outline" loading={save.isPending} disabled={!dirty}>
          {t('common:actions.save')}
        </Button>
        <Badge tone="neutral" dot={false} className="ml-auto hidden sm:inline-flex">
          {t('logs.retention.note')}
        </Badge>
      </form>
    </Card>
  )
}
