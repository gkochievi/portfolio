import { useMemo, useState } from 'react'
import { Plus, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Banner, Button, Dialog, IconButton, SearchInput, Select, Skeleton, toast } from '@/components/ui'
import { cn } from '@/lib/cn'
import { errorMessage } from '@/api/client'
import type { Agent } from '@/types'
import { agentName, useSkills, useTeams, useUpdateAgent } from '../api'
import { DEFAULT_LEVEL, LEVELS, useNames } from '../names'

const LEVEL_OPTIONS = LEVELS.map((n) => ({ value: String(n), label: String(n) }))

export function EditAgentDialog({ agent, onClose }: { agent: Agent | null; onClose: () => void }) {
  if (!agent) return null
  return <EditAgentForm key={agent.userId} agent={agent} onClose={onClose} />
}

function EditAgentForm({ agent, onClose }: { agent: Agent; onClose: () => void }) {
  const { t } = useTranslation('agents')
  const names = useNames()
  const teamsQ = useTeams()
  const skillsQ = useSkills()
  const update = useUpdateAgent()

  const [teamId, setTeamId] = useState(agent.teamId)
  const [levels, setLevels] = useState<Record<string, number>>({ ...agent.skillLevels })
  const [filter, setFilter] = useState('')
  const [error, setError] = useState<string | null>(null)

  const skills = useMemo(
    () =>
      (skillsQ.data ?? [])
        .map((s) => ({ ...s, label: names.skill(s.id, s.name) }))
        .sort((a, b) => names.collator.compare(a.label, b.label)),
    [skillsQ.data, names],
  )
  const teams = useMemo(
    () =>
      (teamsQ.data ?? [])
        .map((x) => ({ ...x, label: names.team(x.id, x.name) }))
        .sort((a, b) => names.collator.compare(a.label, b.label)),
    [teamsQ.data, names],
  )

  const assigned = skills.filter((s) => levels[s.id] !== undefined)
  const q = filter.trim().toLowerCase()
  const available = skills.filter((s) => levels[s.id] === undefined && (!q || s.label.toLowerCase().includes(q) || s.name.toLowerCase().includes(q)))

  const dirty =
    teamId !== agent.teamId ||
    Object.keys(levels).length !== Object.keys(agent.skillLevels).length ||
    Object.entries(levels).some(([id, lvl]) => agent.skillLevels[id] !== lvl)

  const name = agentName(agent)

  const save = () => {
    setError(null)
    update.mutate(
      { userId: agent.userId, update: { teamId, skillLevels: levels } },
      {
        onSuccess: () => {
          toast.success(t('edit.saved', { name }), { duration: 4000 })
          onClose()
        },
        onError: (e) => setError(errorMessage(e, t('edit.saveFailed'))),
      },
    )
  }

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !update.isPending) onClose()
      }}
      dismissible={!update.isPending}
      size="lg"
      title={t('edit.title')}
      description={
        <span>
          <span className="font-medium text-ink">{name}</span>
          <span className="text-muted"> · </span>
          <span className="font-mono text-xs">{agent.userId}</span>
          <span className="text-muted"> · {t('edit.ext', { ext: agent.extension })}</span>
        </span>
      }
      footer={
        <>
          <Button onClick={onClose} disabled={update.isPending}>
            {t('common:actions.cancel')}
          </Button>
          <Button variant="primary" onClick={save} loading={update.isPending} disabled={!dirty || !teamId}>
            {t('common:actions.save')}
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        {error && (
          <Banner tone="danger" onDismiss={() => setError(null)}>
            {error}
          </Banner>
        )}

        <section aria-labelledby="edit-team">
          <h3 id="edit-team" className="eyebrow mb-2">
            {t('edit.team')}
          </h3>
          <p className="mb-2 text-xs text-muted">{t('edit.teamHint')}</p>
          {teamsQ.isLoading ? (
            <Skeleton className="h-8 w-full" />
          ) : (
            <div role="radiogroup" aria-labelledby="edit-team" className="flex flex-wrap gap-2">
              {teams.map((x) => {
                const on = x.id === teamId
                return (
                  <button
                    key={x.id}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    onClick={() => setTeamId(x.id)}
                    className={cn(
                      'rounded-full border px-3 py-1 text-sm transition-colors duration-[160ms] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus',
                      on ? 'border-primary bg-primary/12 font-medium text-primary' : 'border-line bg-panel text-ink hover:bg-hover',
                    )}
                  >
                    {x.label}
                  </button>
                )
              })}
            </div>
          )}
        </section>

        <section aria-labelledby="edit-assigned">
          <div className="mb-2 flex items-baseline justify-between gap-2">
            <h3 id="edit-assigned" className="eyebrow">
              {t('edit.assigned')}
            </h3>
            <span className="tabular text-xs text-muted">{t('edit.assignedCount', { n: assigned.length })}</span>
          </div>
          {skillsQ.isLoading ? (
            <Skeleton className="h-24 w-full" />
          ) : assigned.length === 0 ? (
            <p className="rounded-[8px] border border-dashed border-line px-3 py-4 text-center text-sm text-muted">{t('edit.noneAssigned')}</p>
          ) : (
            <ul className="max-h-56 divide-y divide-line overflow-y-auto rounded-[8px] border border-line">
              {assigned.map((s) => (
                <li key={s.id} className="flex items-center gap-3 px-3 py-1.5">
                  <span className="min-w-0 flex-1 truncate text-sm text-ink">{s.label}</span>
                  <label className="flex items-center gap-2 text-xs text-muted">
                    <span className="hidden sm:inline">{t('edit.competency')}</span>
                    <Select
                      size="sm"
                      className="w-[72px]"
                      aria-label={t('edit.competencyFor', { skill: s.label })}
                      value={String(levels[s.id] ?? DEFAULT_LEVEL)}
                      options={LEVEL_OPTIONS}
                      onValueChange={(v) => setLevels((prev) => ({ ...prev, [s.id]: Number(v) }))}
                    />
                  </label>
                  <IconButton
                    label={t('edit.removeSkill', { skill: s.label })}
                    icon={X}
                    size="sm"
                    onClick={() =>
                      setLevels((prev) => {
                        const next = { ...prev }
                        delete next[s.id]
                        return next
                      })
                    }
                  />
                </li>
              ))}
            </ul>
          )}
        </section>

        <section aria-labelledby="edit-add">
          <h3 id="edit-add" className="eyebrow mb-2">
            {t('edit.add')}
          </h3>
          <SearchInput value={filter} onChange={setFilter} placeholder={t('edit.filter')} />
          <ul className="mt-2 max-h-44 divide-y divide-line overflow-y-auto rounded-[8px] border border-line">
            {available.length === 0 && (
              <li className="px-3 py-3 text-center text-sm text-muted">{q ? t('edit.noMatch') : t('edit.allAssigned')}</li>
            )}
            {available.map((s) => (
              <li key={s.id} className="flex items-center gap-3 px-3 py-1.5">
                <span className="min-w-0 flex-1 truncate text-sm text-ink">{s.label}</span>
                <Button
                  size="sm"
                  icon={Plus}
                  aria-label={t('edit.addSkill', { skill: s.label })}
                  onClick={() =>
                    // A skill that was staffed when the dialog opened comes back with its old level.
                    setLevels((prev) => ({ ...prev, [s.id]: agent.skillLevels[s.id] ?? DEFAULT_LEVEL }))
                  }
                >
                  {t('common:actions.add')}
                </Button>
              </li>
            ))}
          </ul>
          <p className="mt-1.5 text-xs text-muted">{t('edit.addHint', { level: DEFAULT_LEVEL })}</p>
        </section>
      </div>
    </Dialog>
  )
}
