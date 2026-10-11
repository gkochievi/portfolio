import { useState, type ReactNode } from 'react'
import { CheckCircle2, ChevronDown, ChevronRight, Clock, HardDrive, MinusCircle, Plug, Server, XOctagon, type LucideIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Card, CardHeader, DataTable, SectionTitle, StatusChip, type Column, type Tone } from '@/components/ui'
import { cn } from '@/lib/cn'
import { fmtDateTime } from '@/lib/format'
import { useLang } from '@/shell/state'
import type { Paged, TestCategory, TestResult, TestRun } from '@/types'
import { fmtMs } from '../lib/series'

const nw = (v: ReactNode) => <span className="whitespace-nowrap">{v}</span>

const CATEGORIES: { id: TestCategory; icon: LucideIcon }[] = [
  { id: 'core', icon: Server },
  { id: 'cron', icon: Clock },
  { id: 'filesystem', icon: HardDrive },
  { id: 'integration', icon: Plug },
]

const RESULT_ICON = {
  passed: { icon: CheckCircle2, cls: 'text-success' },
  failed: { icon: XOctagon, cls: 'text-danger' },
  skipped: { icon: MinusCircle, cls: 'text-faint' },
} as const

function ResultRow({ r }: { r: TestResult }) {
  const { t } = useTranslation('health')
  const { icon: Icon, cls } = RESULT_ICON[r.status]
  return (
    <li className="flex items-start gap-3 border-t border-line px-4 py-2.5 first:border-t-0">
      <Icon size={18} strokeWidth={1.75} className={cn('mt-0.5 shrink-0', cls)} aria-label={t(`result.${r.status}`)} role="img" />
      <div className="min-w-0 flex-1">
        <div className="text-[14px] font-medium text-ink">{t(`tests.${r.testKey}`, { defaultValue: r.testName })}</div>
        <div className={cn('break-words text-[12.5px]', r.status === 'failed' ? 'text-danger' : 'text-muted')}>{t(`testMessages.${messageKey(r.message)}`, { defaultValue: r.message })}</div>
      </div>
      <span className="shrink-0 pt-0.5 font-mono text-[12.5px] tabular text-faint">{r.status === 'skipped' ? '-' : fmtMs(r.durationMs)}</span>
    </li>
  )
}

function groupBy(results: readonly TestResult[]): Record<TestCategory, TestResult[]> {
  const out: Record<TestCategory, TestResult[]> = { core: [], cron: [], filesystem: [], integration: [] }
  for (const r of results) out[r.category].push(r)
  return out
}

function countChip(items: TestResult[], t: (k: string, o?: Record<string, unknown>) => string) {
  const failed = items.filter((i) => i.status === 'failed').length
  const passed = items.filter((i) => i.status === 'passed').length
  const tone: Tone = failed ? 'danger' : passed === 0 ? 'neutral' : 'success'
  return (
    <StatusChip tone={tone} size="sm">
      {t('selftest.passedOf', { passed, total: items.length })}
    </StatusChip>
  )
}

/** Seeded self-test messages are English sentences; their translations are keyed by a slug of the text. */
const messageKey = (m: string): string => m.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '')

export function SelfTestCards({ run, running }: { run: TestRun | null | undefined; running: boolean }) {
  const { t } = useTranslation('health')
  if (!run) return null
  const groups = groupBy(run.results)
  return (
    <section className="flex flex-col gap-3" aria-busy={running}>
      <SectionTitle>{t('selftest.title')}</SectionTitle>
      <div className={cn('grid gap-3 transition-opacity lg:grid-cols-2', running && 'opacity-60')}>
        {CATEGORIES.map(({ id, icon }) => (
          <Card key={id}>
            <CardHeader title={t(`selftest.category.${id}`)} icon={icon} actions={countChip(groups[id], t)} />
            <ul>
              {groups[id].map((r) => (
                <ResultRow key={r.id} r={r} />
              ))}
            </ul>
          </Card>
        ))}
      </div>
    </section>
  )
}

const RUN_TONE: Record<TestRun['status'], Tone> = { passed: 'success', degraded: 'warning', failed: 'danger' }

export function SelfTestHistory({
  history,
  loading,
  page,
  pageSize,
  onPage,
  onPageSize,
}: {
  history: Paged<TestRun> | undefined
  loading: boolean
  page: number
  pageSize: number
  onPage: (p: number) => void
  onPageSize: (s: number) => void
}) {
  const { t } = useTranslation('health')
  const lang = useLang()
  const [open, setOpen] = useState<ReadonlySet<string>>(new Set())
  const toggle = (id: string) =>
    setOpen((prev) => {
      const next = new Set(prev)
      if (!next.delete(id)) next.add(id)
      return next
    })

  const columns: Column<TestRun>[] = [
    {
      id: 'expand',
      header: <span className="sr-only">{t('history.expand')}</span>,
      width: 36,
      cell: (r) => (open.has(r.id) ? <ChevronDown size={16} aria-hidden /> : <ChevronRight size={16} aria-hidden />),
    },
    { id: 'startedAt', header: t('history.started'), cell: (r) => nw(fmtDateTime(r.startedAt, lang, { seconds: true })) },
    {
      id: 'status',
      header: t('history.status'),
      cell: (r) => <StatusChip tone={RUN_TONE[r.status]} size="sm">{t(`history.state.${r.status}`)}</StatusChip>,
    },
    { id: 'by', header: t('history.by'), hideBelow: 'sm', cell: (r) => (r.triggeredBy === 'schedule' ? t('history.scheduled') : r.triggeredBy) },
    { id: 'total', header: t('banner.total'), align: 'right', mono: true, hideBelow: 'md', cell: (r) => r.total },
    { id: 'passed', header: t('banner.passed'), align: 'right', mono: true, hideBelow: 'md', cell: (r) => r.passed },
    { id: 'failed', header: t('banner.failed'), align: 'right', mono: true, cell: (r) => <span className={cn(r.failed > 0 && 'font-medium text-danger')}>{r.failed}</span> },
    { id: 'skipped', header: t('banner.skipped'), align: 'right', mono: true, hideBelow: 'md', cell: (r) => r.skipped },
    { id: 'duration', header: t('history.duration'), align: 'right', mono: true, hideBelow: 'sm', cell: (r) => nw(fmtMs(r.durationMs)) },
  ]

  return (
    <section className="flex flex-col gap-3">
      <SectionTitle>{t('history.title')}</SectionTitle>
      <Card>
        <DataTable
          columns={columns}
          rows={history?.items}
          rowKey={(r) => r.id}
          loading={loading && !history}
          emptyTitle={t('history.empty')}
          onRowClick={(r) => toggle(r.id)}
          expandedKeys={open}
          renderExpanded={(run) => {
            const groups = groupBy(run.results)
            return (
              <div className="grid gap-3 bg-sunken p-3 lg:grid-cols-2">
                {CATEGORIES.map(({ id }) => (
                  <div key={id} className="overflow-hidden rounded-[8px] border border-line bg-panel">
                    <div className="flex items-center justify-between border-b border-line px-4 py-2">
                      <span className="text-[13px] font-semibold text-ink">{t(`selftest.category.${id}`)}</span>
                      {countChip(groups[id], t)}
                    </div>
                    <ul>
                      {groups[id].map((r) => (
                        <ResultRow key={r.id} r={r} />
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            )
          }}
          paging={{ page, pageSize, total: history?.total ?? 0, onPageChange: onPage, onPageSizeChange: onPageSize }}
          skeletonRows={5}
        />
      </Card>
    </section>
  )
}
