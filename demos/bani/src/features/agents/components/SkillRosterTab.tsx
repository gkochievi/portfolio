import { useMemo, useState } from 'react'
import { CheckCheck, ClipboardCheck, ListChecks, RefreshCw, RotateCcw, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import {
  Badge,
  Banner,
  Button,
  Card,
  CardBody,
  Checkbox,
  Combobox,
  ConfirmDialog,
  DataTable,
  EmptyState,
  ErrorState,
  IconButton,
  SearchInput,
  Select,
  StatusChip,
  Toolbar,
  toast,
  type Column,
} from '@/components/ui'
import { cn } from '@/lib/cn'
import { errorMessage } from '@/api/client'
import type { Agent, RosterApplyResult, RosterChange } from '@/types'
import { agentName, useAgents, useApplyRoster, useSkills, useTeams } from '../api'
import { DEFAULT_LEVEL, LEVELS, useNames } from '../names'
import type { RosterDraft } from '../useRosterDraft'

const LEVEL_OPTIONS = LEVELS.map((n) => ({ value: String(n), label: String(n) }))

interface Row {
  agent: Agent
  /** Level on the server (undefined = not staffed). */
  base: number | undefined
  /** Ticked in the draft view. */
  on: boolean
  level: number
  changed: boolean
}

interface Props {
  skillId: string
  onSkillChange: (skillId: string) => void
  draft: RosterDraft
}

export function SkillRosterTab({ skillId, onSkillChange, draft }: Props) {
  const { t } = useTranslation('agents')
  const names = useNames()
  const agentsQ = useAgents()
  const skillsQ = useSkills()
  const teamsQ = useTeams()
  const apply = useApplyRoster()

  const [query, setQuery] = useState('')
  const [reviewing, setReviewing] = useState(false)
  const [result, setResult] = useState<{ skillId: string; data: RosterApplyResult } | null>(null)

  const skill = skillsQ.data?.find((s) => s.id === skillId)
  const skillLabel = skill ? names.skill(skill.id, skill.name) : ''
  const overrides = draft.get(skillId)

  const teamById = useMemo(() => new Map((teamsQ.data ?? []).map((x) => [x.id, x])), [teamsQ.data])
  const teamLabel = (a: Agent): string => {
    const team = teamById.get(a.teamId)
    return team ? names.team(team.id, team.name) : a.teamId
  }

  const allRows = useMemo<Row[]>(() => {
    if (!skillId) return []
    return (agentsQ.data ?? []).map((agent) => {
      const base = agent.skillLevels[skillId]
      const o = overrides[agent.userId]
      const hasOverride = agent.userId in overrides
      const on = hasOverride ? o !== null : base !== undefined
      const level = hasOverride ? (o ?? DEFAULT_LEVEL) : (base ?? DEFAULT_LEVEL)
      return { agent, base, on, level, changed: hasOverride }
    })
  }, [agentsQ.data, overrides, skillId])

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return allRows
    return allRows.filter(({ agent }) => {
      const team = teamById.get(agent.teamId)
      return [agentName(agent), agent.userId, agent.extension, team?.name ?? '', team ? names.team(team.id, team.name) : '']
        .join(' ')
        .toLowerCase()
        .includes(q)
    })
  }, [allRows, query, teamById, names])

  const pending = useMemo(() => {
    let assign = 0
    let unassign = 0
    let level = 0
    for (const r of allRows) {
      if (!r.changed) continue
      if (r.on && r.base === undefined) assign++
      else if (!r.on && r.base !== undefined) unassign++
      else level++
    }
    return { assign, unassign, level, total: assign + unassign + level }
  }, [allRows])

  const staffedNow = allRows.filter((r) => r.on).length
  const shownOn = rows.filter((r) => r.on).length

  const skillItems = useMemo(
    () =>
      (skillsQ.data ?? [])
        .map((s) => ({ value: s.id, label: names.skill(s.id, s.name), meta: t('roster.assignedCount', { n: s.assignedCount }) }))
        .sort((a, b) => names.collator.compare(a.label, b.label)),
    [skillsQ.data, names, t],
  )

  const setRow = (r: Row, desired: number | null) => draft.edit(skillId, [{ userId: r.agent.userId, base: r.base, desired }])
  const tickShown = (on: boolean) =>
    draft.edit(
      skillId,
      rows.map((r) => ({ userId: r.agent.userId, base: r.base, desired: on ? (r.on ? r.level : (r.base ?? DEFAULT_LEVEL)) : null })),
    )

  const changes = (): RosterChange[] =>
    Object.entries(overrides).map(([userId, level]) => ({ userId, level }))

  const onApply = () => {
    const sent = changes()
    apply.mutate(
      { skillId, changes: sent },
      {
        onSuccess: (data) => {
          setReviewing(false)
          setResult({ skillId, data })
          // Rows the server refused stay pending so they can be retried.
          const failed = new Set(data.failed.map((f) => f.userId))
          draft.replace(skillId, Object.fromEntries(Object.entries(overrides).filter(([u]) => failed.has(u))))
          if (data.failed.length > 0) toast.error(t('result.partial', { n: data.failed.length }))
          else toast.success(t('result.done', { skill: skillLabel }), { duration: 4000 })
        },
        onError: (e) => {
          setReviewing(false)
          toast.error(errorMessage(e, t('result.error')))
        },
      },
    )
  }

  const columns: Column<Row>[] = [
    {
      id: 'on',
      headerClassName: 'text-left',
      header: (
        <Checkbox
          aria-label={t('roster.selectShown')}
          checked={rows.length > 0 && shownOn === rows.length ? true : shownOn > 0 ? 'indeterminate' : false}
          disabled={rows.length === 0}
          onCheckedChange={(v) => tickShown(v)}
        />
      ),
      width: 44,
      cell: (r) => (
        <Checkbox
          aria-label={t('roster.toggle', { name: agentName(r.agent) })}
          checked={r.on}
          onCheckedChange={(v) => setRow(r, v ? (r.base ?? DEFAULT_LEVEL) : null)}
        />
      ),
    },
    {
      id: 'name',
      headerClassName: 'text-left',
      header: t('byAgent.columns.name'),
      sortValue: (r) => `${r.agent.lastName} ${r.agent.firstName}`.toLowerCase(),
      cell: (r) => (
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="font-medium text-ink">{agentName(r.agent)}</span>
            {r.agent.isSupervisor && (
              <StatusChip tone="bronze" size="sm" icon={false}>
                {t('supervisor')}
              </StatusChip>
            )}
          </div>
          <div className="font-mono text-xs text-muted">{r.agent.userId}</div>
        </div>
      ),
    },
    { id: 'extension', headerClassName: 'text-left', header: t('byAgent.columns.extension'), mono: true, hideBelow: 'sm', sortValue: (r) => r.agent.extension, cell: (r) => r.agent.extension },
    { id: 'team', headerClassName: 'text-left', header: t('byAgent.columns.team'), hideBelow: 'md', sortValue: (r) => teamLabel(r.agent), cell: (r) => <Badge>{teamLabel(r.agent)}</Badge> },
    {
      id: 'level',
      header: t('roster.competency'),
      align: 'right',
      width: 108,
      sortValue: (r) => (r.on ? r.level : 0),
      cell: (r) =>
        r.on ? (
          <Select
            size="sm"
            className="ml-auto w-[76px]"
            aria-label={t('roster.levelFor', { name: agentName(r.agent) })}
            value={String(r.level)}
            options={LEVEL_OPTIONS}
            onValueChange={(v) => setRow(r, Number(v))}
          />
        ) : (
          <span className="text-faint" aria-hidden>
            –
          </span>
        ),
    },
  ]

  const selector = (
    <Combobox
      className="w-full sm:w-72"
      aria-label={t('roster.skill')}
      items={skillItems}
      value={skillId}
      onChange={(v) => {
        setResult(null)
        setQuery('')
        onSkillChange(v)
      }}
      placeholder={t('roster.choose')}
      searchPlaceholder={t('roster.searchSkills')}
      emptyText={t('roster.noSkills')}
      disabled={skillsQ.isLoading}
    />
  )

  if (agentsQ.isError || skillsQ.isError)
    return <ErrorState error={agentsQ.error ?? skillsQ.error} onRetry={() => void Promise.all([agentsQ.refetch(), skillsQ.refetch()])} />

  if (!skillId || !skill) {
    return (
      <>
        <Toolbar>{selector}</Toolbar>
        <Card>
          <CardBody>
            <EmptyState icon={ListChecks} title={t('roster.pickTitle')} body={t('roster.pickBody')} />
          </CardBody>
        </Card>
      </>
    )
  }

  const shownResult = result && result.skillId === skillId ? result.data : null

  return (
    <>
      <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center">
          {selector}
          <div className="w-full sm:w-72">
            <SearchInput value={query} onChange={setQuery} placeholder={t('byAgent.search')} />
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <>
            <span className="tabular text-sm text-muted" aria-live="polite">
              {t('byAgent.count', { filtered: rows.length, total: allRows.length })}
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

      {shownResult && <ResultCard data={shownResult} onClose={() => setResult(null)} />}

      {staffedNow === 0 && !agentsQ.isLoading && (
        <Card className="mb-3">
          <CardBody>
            <EmptyState title={t('roster.unstaffedTitle', { skill: skillLabel })} body={t('roster.unstaffedBody')} compact />
          </CardBody>
        </Card>
      )}

      <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-[10px] border border-line bg-panel px-3 py-2">
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" icon={CheckCheck} disabled={rows.length === 0} onClick={() => tickShown(true)}>
            {t('roster.selectShown')}
          </Button>
          <Button size="sm" icon={X} disabled={shownOn === 0} onClick={() => tickShown(false)}>
            {t('roster.clearShown')}
          </Button>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {pending.total === 0 ? (
            <span className="text-sm text-muted">{t('roster.noPending')}</span>
          ) : (
            <span className="flex flex-wrap items-center gap-1.5" aria-live="polite">
              {pending.assign > 0 && <StatusChip tone="success" size="sm">{t('roster.toAssign', { n: pending.assign })}</StatusChip>}
              {pending.unassign > 0 && <StatusChip tone="danger" size="sm">{t('roster.toUnassign', { n: pending.unassign })}</StatusChip>}
              {pending.level > 0 && <StatusChip tone="warning" size="sm">{t('roster.levelChanges', { n: pending.level })}</StatusChip>}
            </span>
          )}
          <Button size="sm" icon={RotateCcw} disabled={pending.total === 0 || apply.isPending} onClick={() => draft.reset(skillId)}>
            {t('common:actions.reset')}
          </Button>
          <Button size="sm" variant="primary" icon={ClipboardCheck} disabled={pending.total === 0} onClick={() => setReviewing(true)}>
            {t('common:actions.review')}
          </Button>
        </div>
      </div>

      <DataTable
        columns={columns}
        rows={rows}
        rowKey={(r) => r.agent.userId}
        loading={agentsQ.isLoading}
        pageSize={0}
        maxHeight={560}
        defaultSort={{ id: 'name', dir: 'asc' }}
        rowClassName={(r) => (r.changed ? 'outline outline-1 -outline-offset-1 outline-warning bg-warning/5' : undefined)}
        emptyTitle={t('byAgent.emptyTitle')}
        emptyBody={t('byAgent.emptyBody')}
      />

      <ConfirmDialog
        open={reviewing}
        onOpenChange={(o) => {
          if (!apply.isPending) setReviewing(o)
        }}
        title={t('review.title', { skill: skillLabel })}
        confirmLabel={t('common:actions.apply')}
        busy={apply.isPending}
        onConfirm={onApply}
        body={
          <div className="space-y-3 text-left">
            <Banner tone="warning">{t('review.warning')}</Banner>
            <ul className="space-y-1 text-sm">
              {pending.assign > 0 && <li>{t('roster.toAssign', { n: pending.assign })}</li>}
              {pending.unassign > 0 && <li>{t('roster.toUnassign', { n: pending.unassign })}</li>}
              {pending.level > 0 && <li>{t('roster.levelChanges', { n: pending.level })}</li>}
            </ul>
          </div>
        }
      />
    </>
  )
}

function ResultCard({ data, onClose }: { data: RosterApplyResult; onClose: () => void }) {
  const { t } = useTranslation('agents')
  const stats: { key: string; value: number; tone: string }[] = [
    { key: 'assigned', value: data.assigned, tone: 'text-success' },
    { key: 'unassigned', value: data.unassigned, tone: 'text-info' },
    { key: 'levelChanged', value: data.levelChanged, tone: 'text-warning' },
    { key: 'unchanged', value: data.unchanged, tone: 'text-muted' },
    { key: 'failed', value: data.failed.length, tone: data.failed.length > 0 ? 'text-danger' : 'text-muted' },
  ]
  return (
    <Card className="mb-3" role="status">
      <CardBody>
        <div className="mb-3 flex items-start justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-ink">{t('result.title')}</h3>
            <p className="text-xs text-muted">{data.failed.length > 0 ? t('result.partialHint') : t('result.doneHint')}</p>
          </div>
          <IconButton label={t('common:actions.close')} icon={X} size="sm" onClick={onClose} />
        </div>
        <dl className="grid grid-cols-2 gap-2 sm:grid-cols-5">
          {stats.map((s) => (
            <div key={s.key} className="rounded-[8px] bg-sunken px-3 py-2">
              <dt className="text-xs text-muted">{t(`result.${s.key}`)}</dt>
              <dd className={cn('tabular font-display text-xl font-semibold', s.tone)}>{s.value}</dd>
            </div>
          ))}
        </dl>
        {data.failed.length > 0 && (
          <ul className="mt-3 divide-y divide-line rounded-[8px] border border-danger/30">
            {data.failed.map((f) => (
              <li key={f.userId} className="flex flex-wrap items-baseline justify-between gap-2 px-3 py-1.5 text-sm">
                <span>
                  <span className="font-medium text-ink">{f.name}</span> <span className="font-mono text-xs text-muted">{f.userId}</span>
                </span>
                <span className="text-danger">{f.reason === 'Locked by another session' ? t('result.locked') : f.reason === 'Agent not found' ? t('result.notFound') : f.reason}</span>
              </li>
            ))}
          </ul>
        )}
      </CardBody>
    </Card>
  )
}
