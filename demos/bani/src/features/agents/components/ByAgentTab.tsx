import { useMemo, useState } from 'react'
import { Pencil, RefreshCw } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import {
  Badge,
  Button,
  DataTable,
  ErrorState,
  IconButton,
  SearchInput,
  StatusChip,
  Tooltip,
  type Column,
} from '@/components/ui'
import type { Agent, Team, SkillWithCount } from '@/types'
import { agentName, useAgents, useSkills, useTeams } from '../api'
import { useNames } from '../names'
import { EditAgentDialog } from './EditAgentDialog'

export function ByAgentTab() {
  const { t } = useTranslation('agents')
  const names = useNames()
  const agentsQ = useAgents()
  const skillsQ = useSkills()
  const teamsQ = useTeams()
  const [query, setQuery] = useState('')
  const [editing, setEditing] = useState<Agent | null>(null)

  const agents = agentsQ.data
  const teamById = useMemo(() => new Map<string, Team>((teamsQ.data ?? []).map((x) => [x.id, x])), [teamsQ.data])
  const skillById = useMemo(() => new Map<string, SkillWithCount>((skillsQ.data ?? []).map((x) => [x.id, x])), [skillsQ.data])

  const teamLabel = (a: Agent): string => {
    const team = teamById.get(a.teamId)
    return team ? names.team(team.id, team.name) : a.teamId
  }

  const rows = useMemo(() => {
    const list = agents ?? []
    const q = query.trim().toLowerCase()
    if (!q) return list
    return list.filter((a) => {
      const team = teamById.get(a.teamId)
      const hay = [agentName(a), a.userId, a.extension, team?.name ?? '', team ? names.team(team.id, team.name) : ''].join(' ').toLowerCase()
      return hay.includes(q)
    })
  }, [agents, query, teamById, names])

  if (agentsQ.isError) return <ErrorState error={agentsQ.error} onRetry={() => void agentsQ.refetch()} />

  const columns: Column<Agent>[] = [
    {
      id: 'name',
      headerClassName: 'text-left',
      header: t('byAgent.columns.name'),
      sortValue: (a) => `${a.lastName} ${a.firstName}`.toLowerCase(),
      cell: (a) => (
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="font-medium text-ink">{agentName(a)}</span>
            {a.isSupervisor && (
              <StatusChip tone="bronze" size="sm" icon={false}>
                {t('supervisor')}
              </StatusChip>
            )}
          </div>
          <div className="font-mono text-xs text-muted">{a.userId}</div>
        </div>
      ),
    },
    { id: 'extension', headerClassName: 'text-left', header: t('byAgent.columns.extension'), mono: true, sortValue: (a) => a.extension, cell: (a) => a.extension },
    {
      id: 'team',
      headerClassName: 'text-left',
      header: t('byAgent.columns.team'),
      hideBelow: 'sm',
      sortValue: (a) => teamLabel(a),
      cell: (a) => <Badge>{teamLabel(a)}</Badge>,
    },
    {
      id: 'skills',
      header: t('byAgent.columns.skills'),
      align: 'right',
      sortValue: (a) => Object.keys(a.skillLevels).length,
      cell: (a) => {
        const ids = Object.keys(a.skillLevels)
        if (ids.length === 0) return <span className="text-faint">0</span>
        return (
          <Tooltip
            side="left"
            content={
              <ul className="space-y-0.5 text-left">
                {ids
                  .map((id) => ({ id, label: names.skill(id, skillById.get(id)?.name ?? id), level: a.skillLevels[id] ?? 0 }))
                  .sort((x, y) => names.collator.compare(x.label, y.label))
                  .map((s) => (
                    <li key={s.id} className="flex items-center justify-between gap-4">
                      <span>{s.label}</span>
                      <span className="font-mono tabular">{s.level}</span>
                    </li>
                  ))}
              </ul>
            }
          >
            <button
              type="button"
              className="tabular cursor-help rounded-[6px] px-1.5 py-0.5 font-mono text-sm text-ink underline decoration-dotted decoration-line-strong underline-offset-4 hover:bg-hover"
              aria-label={t('byAgent.skillsCount', { n: ids.length })}
            >
              {ids.length}
            </button>
          </Tooltip>
        )
      },
    },
    {
      id: 'actions',
      header: <span className="sr-only">{t('byAgent.columns.actions')}</span>,
      align: 'right',
      width: 52,
      cell: (a) => (
        <IconButton
          label={t('byAgent.edit', { name: agentName(a) })}
          icon={Pencil}
          size="sm"
          onClick={(e) => {
            e.stopPropagation()
            setEditing(a)
          }}
        />
      ),
    },
  ]

  return (
    <>
      <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center">
          <div className="w-full sm:w-72">
            <SearchInput value={query} onChange={setQuery} placeholder={t('byAgent.search')} />
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <>
            <span className="tabular text-sm text-muted" aria-live="polite">
              {t('byAgent.count', { filtered: rows.length, total: agents?.length ?? 0 })}
            </span>
            <Button
              size="sm"
              icon={RefreshCw}
              loading={agentsQ.isFetching && !agentsQ.isLoading}
              onClick={() => {
                void agentsQ.refetch()
                void skillsQ.refetch()
              }}
            >
              {t('common:actions.refresh')}
            </Button>
          </>
        </div>
      </div>
      <DataTable
        columns={columns}
        rows={rows}
        rowKey={(a) => a.userId}
        loading={agentsQ.isLoading}
        pageSize={25}
        pageSizes={[25, 50, 100]}
        defaultSort={{ id: 'name', dir: 'asc' }}
        onRowClick={(a) => setEditing(a)}
        emptyTitle={t('byAgent.emptyTitle')}
        emptyBody={t('byAgent.emptyBody')}
      />
      <EditAgentDialog agent={editing} onClose={() => setEditing(null)} />
    </>
  )
}
