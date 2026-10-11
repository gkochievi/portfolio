import { Download, FileSpreadsheet, PackageOpen, Info } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'

import { errorMessage } from '@/api/client'
import {
  Banner,
  Button,
  Card,
  FilterChip,
  KpiTile,
  PageHeader,
  Pagination,
  SearchInput,
  SegmentedControl,
  Switch,
  Toolbar,
  toast,
} from '@/components/ui'
import { fromTenantInput, tenantDayRange, toTenantInput } from '@/lib/format'
import { useMe } from '@/shell/useMe'
import type { CdrSource, UnifiedCdr } from '@/types'
import { useCallSearch, useRecordingBundle, type SearchParams } from '../api'
import { CallDrawer, type DrawerTab } from '../components/CallDrawer'
import { CallsTable } from '../components/CallsTable'
import { SearchForm, type FormValues } from '../components/SearchForm'
import { useCallLabels } from '../components/useCallLabels'
import { downloadRecordings, exportRowsToXlsx } from '../lib/exportCalls'
import { recordingLegId } from '../lib/legs'
import { mergeCalls } from '../lib/mergeCalls'
import { DEFAULT_SORT, filterRows, sortRows, type ColumnFilters, type ColumnId, type SortState } from '../lib/rows'

const PAGE_SIZES = [25, 50, 100, 200, 500]
const DAY = 86_400_000

/** Default form: today 00:00-23:59 tenant time. A number deep link (Cmd-K) looks back two weeks. */
function defaultForm(number = ''): FormValues {
  const today = tenantDayRange()
  const from = number ? new Date(Date.parse(today.from) - 13 * DAY).toISOString() : today.from
  return { number, recordingFile: '', from: toTenantInput(from), to: toTenantInput(today.to), source: 'both' }
}

function toParams(form: FormValues, nonce: number): SearchParams {
  const day = tenantDayRange()
  const file = form.recordingFile.trim()
  return {
    nonce,
    number: file ? '' : form.number.trim(),
    recordingFile: file || undefined,
    dateFrom: file || !form.from ? day.from : fromTenantInput(form.from),
    // datetime-local has minute precision: include the whole end minute.
    dateTo: file || !form.to ? day.to : new Date(Date.parse(fromTenantInput(form.to)) + 59_999).toISOString(),
    source: form.source,
  }
}

function findRow(rows: UnifiedCdr[], id: string): UnifiedCdr | null {
  return rows.find((r) => r.id === id || r.rawData.id === id || r.segments?.some((s) => s.id === id || s.rawData.id === id)) ?? null
}

export default function CallsPage() {
  const { t, tt, labels } = useCallLabels()
  const { cdrSources } = useMe()
  const [params, setParams] = useSearchParams()

  // ---- search form + submitted search
  const numberParam = params.get('number') ?? ''
  const [form, setForm] = useState<FormValues>(() => defaultForm(numberParam))
  const nonce = useRef(1)
  const [submitted, setSubmitted] = useState<SearchParams>(() => toParams(defaultForm(numberParam), nonce.current))
  const query = useCallSearch(submitted)
  const data = query.data

  // ---- table state (reset on every new search)
  const [combine, setCombine] = useState(true)
  const [globalFilter, setGlobalFilter] = useState('')
  const [colFilters, setColFilters] = useState<ColumnFilters>({})
  const [sort, setSort] = useState<SortState>(DEFAULT_SORT)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(50)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [zipFormat, setZipFormat] = useState<'original' | 'mp3'>('original')

  // ---- drawer
  const [open, setOpen] = useState<{ id: string; tab: DrawerTab } | null>(() => {
    const id = params.get('call')
    return id ? { id, tab: 'details' } : null
  })

  const run = useCallback((next: FormValues) => {
    nonce.current += 1
    setSubmitted(toParams(next, nonce.current))
    setGlobalFilter('')
    setColFilters({})
    setSort(DEFAULT_SORT)
    setPage(1)
    setSelected(new Set())
    setExpanded(new Set())
    setOpen(null)
    setParams(
      (p) => {
        if (!p.has('call')) return p
        const n = new URLSearchParams(p)
        n.delete('call')
        return n
      },
      { replace: true },
    )
  }, [setParams])

  // A new ?number= (Cmd-K) while the page is open runs that search.
  const lastNumber = useRef(numberParam)
  useEffect(() => {
    if (numberParam && numberParam !== lastNumber.current) {
      lastNumber.current = numberParam
      const next = defaultForm(numberParam)
      setForm(next)
      run(next)
    }
  }, [numberParam, run])

  const reset = () => {
    const next = defaultForm()
    lastNumber.current = ''
    setForm(next)
    setCombine(true)
    setOpen(null)
    setParams({}, { replace: true })
    run(next)
  }

  // ---- derived rows
  const merged = useMemo<UnifiedCdr[]>(() => (data ? (combine ? mergeCalls(data.results) : data.results) : []), [data, combine])
  const filtered = useMemo(() => filterRows(merged, globalFilter, colFilters, labels), [merged, globalFilter, colFilters, labels])
  const sorted = useMemo(() => sortRows(filtered, sort, labels), [filtered, sort, labels])
  const pages = Math.max(1, Math.ceil(sorted.length / pageSize))
  const safePage = Math.min(page, pages)
  const pageRows = useMemo(() => sorted.slice((safePage - 1) * pageSize, safePage * pageSize), [sorted, safePage, pageSize])
  const filtersActive = globalFilter.trim() !== '' || Object.values(colFilters).some((v) => (v ?? '').trim() !== '')

  const openRow = open && data ? findRow(merged, open.id) : null
  const notFound = !!open && !!data && !openRow && !query.isFetching

  const counts = useMemo(() => {
    const c: Record<CdrSource, number> = { core: 0, edge: 0 }
    for (const r of merged) c[r.source] += 1
    return c
  }, [merged])

  const openDrawer = (row: UnifiedCdr, tab: DrawerTab) => {
    setOpen({ id: row.id, tab })
    setParams(
      (p) => {
        const n = new URLSearchParams(p)
        n.set('call', row.id)
        return n
      },
      { replace: true },
    )
  }
  const closeDrawer = () => {
    setOpen(null)
    setParams(
      (p) => {
        const n = new URLSearchParams(p)
        n.delete('call')
        return n
      },
      { replace: true },
    )
  }

  // ---- selection helpers
  const toggle = (id: string) =>
    setSelected((s) => {
      const n = new Set(s)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })
  const togglePage = (checked: boolean) =>
    setSelected((s) => {
      const n = new Set(s)
      for (const r of pageRows) {
        if (checked) n.add(r.id)
        else n.delete(r.id)
      }
      return n
    })
  const expand = (id: string) =>
    setExpanded((s) => {
      const n = new Set(s)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })

  // ---- exports
  const bundle = useRecordingBundle()
  const selectedRows = useMemo(() => merged.filter((r) => selected.has(r.id)), [merged, selected])
  const downloadZip = async () => {
    const byLeg = new Map<string, UnifiedCdr>()
    for (const r of selectedRows) byLeg.set(recordingLegId(r) ?? r.rawData.id, r)
    try {
      const res = await bundle.mutateAsync({ callIds: [...byLeg.keys()], format: zipFormat })
      if (res.included.length === 0) {
        toast.warning(t('zip.noneIncluded', { skipped: res.skipped.length }))
        return
      }
      await downloadRecordings(res, { rows: byLeg, format: zipFormat, labels, t: tt })
      toast.success(t('zip.done', { included: res.included.length, skipped: res.skipped.length }))
    } catch (e) {
      toast.error(errorMessage(e, t('zip.failed')))
    }
  }
  const exportExcel = () => {
    try {
      const n = exportRowsToXlsx(sorted, tt, labels)
      toast.success(t('export.done', { count: n }))
    } catch (e) {
      toast.error(errorMessage(e, t('export.failed')))
    }
  }

  // ---- banners
  const warnings = (data?.warnings ?? []).map((w) => {
    const [code, arg] = w.split(':')
    return t(`warnings.${code}`, { days: arg, defaultValue: w })
  })
  const sourceErrors = data
    ? (['core', 'edge'] as const).flatMap((s) => {
        const info = data.sources[s]
        return info.available ? [] : [{ source: s, message: t(`errors.${info.error ?? 'unavailable'}`, { defaultValue: info.error ?? '' }) }]
      })
    : []

  const searching = query.isFetching
  const showSource = cdrSources.length !== 1

  return (
    <div className="space-y-4">
      <PageHeader title={t('title')} subtitle={t('subtitle')} />

      <SearchForm
        values={form}
        onChange={(patch) => setForm((f) => ({ ...f, ...patch }))}
        onSubmit={() => run(form)}
        onReset={reset}
        searching={searching}
        showSource={showSource}
      />

      {query.isError && (
        <Banner
          tone="danger"
          title={t('errors.searchFailed')}
          actions={
            <Button size="sm" variant="secondary" onClick={() => void query.refetch()}>
              {t('errors.retry')}
            </Button>
          }
        >
          {errorMessage(query.error)}
        </Banner>
      )}
      {sourceErrors.map((e) => (
        <Banner key={e.source} tone="danger" title={labels.source(e.source)}>
          {e.message}
        </Banner>
      ))}
      {warnings.map((w) => (
        <Banner key={w} tone="warning">
          {w}
        </Banner>
      ))}
      {notFound && (
        <Banner tone="info" onDismiss={closeDrawer}>
          {t('drawer.notInResults')}
        </Banner>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <KpiTile label={t('kpi.total')} value={data ? merged.length : '…'} hint={data && combine ? t('kpi.legsHint', { count: data.results.length }) : undefined} />
        {(['core', 'edge'] as const)
          .filter((s) => cdrSources.length === 0 || cdrSources.includes(s))
          .map((s) => (
            <KpiTile
              key={s}
              label={labels.source(s)}
              value={data ? counts[s] : '…'}
              tone={data && !data.sources[s].available ? 'danger' : undefined}
              hint={data && !data.sources[s].available ? t('kpi.unavailable') : undefined}
            />
          ))}
        {combine && <KpiTile label={t('kpi.combined')} value={data ? data.results.length - merged.length : '…'} hint={t('kpi.combinedHint')} />}
        <KpiTile label={t('kpi.shown')} value={data ? filtered.length : '…'} hint={filtersActive ? t('kpi.filtered') : undefined} tone={filtersActive ? 'bronze' : undefined} />
      </div>

      <Card className="overflow-hidden">
        <div className="space-y-3 border-b border-line px-4 py-3">
          <Toolbar
            actions={
              <>
                <Button variant="secondary" icon={FileSpreadsheet} onClick={exportExcel} disabled={!data || sorted.length === 0}>
                  {t('toolbar.exportExcel')}
                </Button>
                <SegmentedControl<'original' | 'mp3'>
                  size="sm"
                  aria-label={t('toolbar.zipFormat')}
                  value={zipFormat}
                  onChange={setZipFormat}
                  options={[
                    { value: 'original', label: t('toolbar.zipOriginal') },
                    { value: 'mp3', label: 'MP3' },
                  ]}
                />
                <Button
                  variant="primary"
                  icon={Download}
                  loading={bundle.isPending}
                  disabled={selected.size === 0 || bundle.isPending}
                  onClick={() => void downloadZip()}
                >
                  {t('toolbar.downloadZip', { count: selected.size })}
                </Button>
              </>
            }
          >
            <SearchInput
              value={globalFilter}
              onChange={(v) => {
                setGlobalFilter(v)
                setPage(1)
              }}
              placeholder={t('toolbar.searchAll')}
            />
            <Switch checked={combine} onCheckedChange={setCombine} label={t('toolbar.combine')} />
            {filtersActive && (
              <FilterChip
                label={t('toolbar.clearFilters')}
                active
                onClear={() => {
                  setGlobalFilter('')
                  setColFilters({})
                  setPage(1)
                }}
              />
            )}
          </Toolbar>
          {zipFormat === 'mp3' && (
            <p className="flex items-center gap-1.5 text-[12px] text-muted">
              <Info size={13} aria-hidden /> {t('toolbar.mp3Note')}
            </p>
          )}
          {selected.size > 0 && (
            <p className="flex items-center gap-2 text-[12.5px] text-muted">
              <PackageOpen size={14} aria-hidden />
              {t('toolbar.selected', { count: selected.size })}
              <button type="button" className="text-primary underline-offset-2 hover:underline" onClick={() => setSelected(new Set())}>
                {t('toolbar.clearSelection')}
              </button>
            </p>
          )}
        </div>

        <CallsTable
          rows={pageRows}
          loading={searching && !data}
          sort={sort}
          onSort={(s) => {
            setSort(s)
            setPage(1)
          }}
          filters={colFilters}
          onFilter={(id: ColumnId, v) => {
            setColFilters((f) => ({ ...f, [id]: v }))
            setPage(1)
          }}
          selected={selected}
          onToggle={toggle}
          onTogglePage={togglePage}
          expanded={expanded}
          onExpand={expand}
          activeId={openRow?.id ?? null}
          onOpen={openDrawer}
          emptyTitle={filtersActive ? t('empty.filteredTitle') : t('empty.title')}
          emptyBody={filtersActive ? t('empty.filteredBody') : t('empty.body')}
          emptyAction={
            filtersActive ? (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  setGlobalFilter('')
                  setColFilters({})
                }}
              >
                {t('toolbar.clearFilters')}
              </Button>
            ) : undefined
          }
        />

        {data && sorted.length > 0 && (
          <Pagination
            page={safePage}
            pageSize={pageSize}
            total={sorted.length}
            onPageChange={setPage}
            onPageSizeChange={(n) => {
              setPageSize(n)
              setPage(1)
            }}
            pageSizes={PAGE_SIZES}
          />
        )}
      </Card>

      <CallDrawer
        row={openRow}
        tab={open?.tab ?? 'details'}
        onTabChange={(tab) => setOpen((o) => (o ? { ...o, tab } : o))}
        onClose={closeDrawer}
      />
    </div>
  )
}
