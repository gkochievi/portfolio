/** AI setup: the defaults per capability and which connection each workspace actually uses. */
import { useMemo, useState } from 'react'
import { ChevronRight, TriangleAlert } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

import { Badge, Button, Card, Callout, DataTable, EmptyState, PageHeader, SearchInput, Toolbar, type Column } from '@/components/ui'
import { cn } from '@/lib/cn'
import type { AiCapability } from '@/types'
import { useAssignments } from '../api'
import { CapabilityLabel, QueryState, capabilityIcon } from '../components/bits'
import { workspaceName } from '../components/IntegrationDialog'
import { CAPABILITIES, type AssignmentCell, type AssignmentRow } from '../types'

function EffectiveCell({ cell }: { cell: AssignmentCell }) {
  const { t } = useTranslation('consoleAi')
  if (cell.source === 'default' && !cell.connection_id) {
    return <span className="text-[13px] text-subtle">{t('setup.noDefault')}</span>
  }
  const own = cell.source === 'byo'
  const legacy = cell.source === 'legacy'
  const assigned = cell.source === 'assigned'
  return (
    <div className="min-w-0 max-w-56">
      <div className="flex flex-wrap items-center gap-1.5">
        {own ? (
          <Badge tone="accent">{t('setup.ownKey')}</Badge>
        ) : legacy ? (
          <Badge tone="info">{t('setup.legacy')}</Badge>
        ) : (
          <span className={cn('truncate text-[13px]', assigned ? 'font-semibold text-ink' : 'font-normal text-muted')} title={t(assigned ? 'setup.assignedTip' : 'setup.inheritedTip')}>
            {cell.name}
          </span>
        )}
      </div>
      <div className="mt-0.5 truncate font-mono text-xs text-subtle">{cell.model}</div>
    </div>
  )
}

export default function AiConfigPage() {
  const { t, i18n } = useTranslation('consoleAi')
  const lang = i18n.language
  const navigate = useNavigate()
  const query = useAssignments()
  const [q, setQ] = useState('')

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase()
    const all = query.data?.rows ?? []
    if (!needle) return all
    return all.filter((r) => [r.name, r.name_ka, r.slug, ...CAPABILITIES.map((c) => r.cells[c].name + ' ' + r.cells[c].model)].some((s) => s.toLowerCase().includes(needle)))
  }, [q, query.data])

  const columns: Column<AssignmentRow>[] = [
    {
      key: 'name',
      header: t('setup.workspace'),
      sortable: (r) => workspaceName(r, lang),
      cell: (r) => (
        <div className="min-w-0">
          <Link to={`/ai-config/${r.tenant_id}`} className="font-medium text-ink hover:text-primary" onClick={(e) => e.stopPropagation()}>
            {workspaceName(r, lang)}
          </Link>
          <div className="flex items-center gap-1.5 text-xs text-subtle">
            <span className="font-mono">{r.slug}</span>
            {!r.is_active ? <Badge size="sm">{t('setup.inactive')}</Badge> : null}
          </div>
        </div>
      ),
    },
    ...CAPABILITIES.map<Column<AssignmentRow>>((cap) => ({
      key: cap,
      header: t(`capability.${cap}`),
      sortable: (r) => r.cells[cap].name,
      cell: (r) => <EffectiveCell cell={r.cells[cap]} />,
    })),
    {
      key: 'open',
      header: <span className="sr-only">{t('setup.open')}</span>,
      align: 'right',
      width: '40px',
      cell: () => <ChevronRight className="ml-auto size-4 text-subtle" aria-hidden />,
    },
  ]

  return (
    <div className="space-y-5">
      <PageHeader
        title={t('setup.title')}
        description={t('setup.description')}
        actions={
          <Button asChild variant="secondary">
            <Link to="/console/ai-providers">{t('setup.openRegistry')}</Link>
          </Button>
        }
      />

      <QueryState loading={query.isLoading} error={query.error} onRetry={() => void query.refetch()} rows={4}>
        {query.data ? (
          <>
            <section aria-label={t('setup.defaults')} className="grid gap-4 md:grid-cols-3">
              {CAPABILITIES.map((cap: AiCapability) => {
                const d = query.data.defaults[cap]
                const Icon = capabilityIcon[cap]
                return (
                  <Card key={cap}>
                    <div className="flex items-center gap-2 text-[13px] text-muted">
                      <Icon className="size-4" strokeWidth={1.75} aria-hidden />
                      <CapabilityLabel capability={cap} />
                      <span className="ml-auto">{t('setup.defaultLabel')}</span>
                    </div>
                    {d ? (
                      <>
                        <div className="mt-2 font-display text-xl font-semibold">{d.name}</div>
                        <div className="mt-0.5 truncate font-mono text-xs text-muted">{d.model}</div>
                      </>
                    ) : (
                      <div className="mt-2 flex items-start gap-2 text-[13px] text-warning">
                        <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
                        {t('setup.noDefaultCard')}
                      </div>
                    )}
                  </Card>
                )
              })}
            </section>

            <Callout tone="info">{t('setup.legend')}</Callout>

            <Toolbar>
              <div className="w-full sm:w-80">
                <SearchInput value={q} onChange={setQ} placeholder={t('setup.search')} />
              </div>
            </Toolbar>

            <DataTable
              rows={rows}
              columns={columns}
              rowKey={(r) => r.tenant_id}
              onRowClick={(r) => navigate(`/ai-config/${r.tenant_id}`)}
              pageSize={0}
              caption={t('setup.tableCaption')}
              empty={<EmptyState compact title={t('setup.noMatches')} body={t('setup.noMatchesBody')} />}
            />
          </>
        ) : null}
      </QueryState>
    </div>
  )
}
